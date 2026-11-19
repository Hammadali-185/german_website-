import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../utils/http.js";
import { presentOrder } from "../orders/orders.service.js";
import { SALES_EXCLUDED_STATUSES, addCalendarDays, berlinInstant, utcTimestamp } from "./reporting.js";

export const DELIVERY_QUEUES = {
  pending: ["PENDING", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP"],
  active: ["OUT_FOR_DELIVERY"],
  completed: ["COMPLETED"],
  rejected: ["REJECTED"],
  cancelled: ["CANCELLED"],
} as const;

export type DeliveryQueue = keyof typeof DELIVERY_QUEUES | "all";

const orderInclude = {
  items: true,
  payment: true,
  deliveryArea: true,
  statusEvents: { orderBy: { createdAt: "asc" as const } },
};

export type OrderListQuery = {
  q?: string;
  status?: string;
  fulfillment?: "DELIVERY" | "PICKUP";
  from?: string;
  to?: string;
  sort: "newest" | "oldest";
  page: number;
  pageSize: number;
  queue?: DeliveryQueue;
};

function textList(values: readonly string[]) {
  return Prisma.join(values.map((value) => Prisma.sql`${value}`));
}

export function searchClauses(raw: string | undefined) {
  const q = (raw ?? "").trim().slice(0, 80).replace(/[%_]/g, "");
  if (!q) return [];
  const like = `%${q}%`;
  const clauses = [
    Prisma.sql`o."customerFirstName" ILIKE ${like}`,
    Prisma.sql`o."customerLastName" ILIKE ${like}`,
    Prisma.sql`(o."customerFirstName" || ' ' || o."customerLastName") ILIKE ${like}`,
  ];
  const code = q.replace(/^PB-/i, "");
  if (/^\d+$/.test(code) && code.length <= 9) clauses.push(Prisma.sql`o."publicNumber" = ${Number(code)}`);
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 3) clauses.push(Prisma.sql`regexp_replace(o."customerPhone", '[^0-9]', '', 'g') LIKE ${`%${digits}%`}`);
  return clauses;
}

function whereSql(query: OrderListQuery, fulfillment: "DELIVERY" | "PICKUP" | undefined) {
  const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (fulfillment) parts.push(Prisma.sql`o.fulfillment::text = ${fulfillment}`);
  const statuses = query.queue && query.queue !== "all" ? DELIVERY_QUEUES[query.queue] : query.status ? [query.status] : null;
  if (statuses) parts.push(Prisma.sql`o.status::text IN (${textList(statuses)})`);
  if (query.from || query.to) {
    if (query.from && query.to && query.from > query.to) throw new HttpError(400, "Der Zeitraum ist ungültig.", "BAD_RANGE");
    try {
      if (query.from) parts.push(Prisma.sql`o."createdAt" >= ${utcTimestamp(berlinInstant(query.from))}::timestamp`);
      if (query.to) parts.push(Prisma.sql`o."createdAt" < ${utcTimestamp(berlinInstant(addCalendarDays(query.to, 1)))}::timestamp`);
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Der Zeitraum ist ungültig.", "BAD_RANGE");
    }
  }
  const search = searchClauses(query.q);
  if (search.length) parts.push(Prisma.sql`(${Prisma.join(search, " OR ")})`);
  return Prisma.join(parts, " AND ");
}

async function pageOrders(query: OrderListQuery, fulfillment: "DELIVERY" | "PICKUP" | undefined) {
  const offset = (query.page - 1) * query.pageSize;
  const oldest = query.sort === "oldest";
  const [countRows, idRows] = await Promise.all([
    prisma.$queryRaw<{ count: unknown }[]>`SELECT COUNT(*) AS count FROM "Order" o WHERE ${whereSql(query, fulfillment)}`,
    prisma.$queryRaw<{ id: string }[]>`
      SELECT o.id FROM "Order" o
      WHERE ${whereSql(query, fulfillment)}
      ORDER BY o."createdAt" ${oldest ? Prisma.sql`ASC` : Prisma.sql`DESC`}, o.id ${oldest ? Prisma.sql`ASC` : Prisma.sql`DESC`}
      LIMIT ${query.pageSize} OFFSET ${offset}
    `,
  ]);
  const total = Number(countRows[0]?.count ?? 0);
  const ids = idRows.map((row) => row.id);
  if (!ids.length) return { items: [], total, page: query.page, pageSize: query.pageSize };
  const orders = await prisma.order.findMany({ where: { id: { in: ids } }, include: orderInclude });
  const byId = new Map(orders.map((order) => [order.id, order]));
  return {
    items: ids.flatMap((id) => {
      const order = byId.get(id);
      return order ? [presentOrder(order)] : [];
    }),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export function listAdminOrders(query: OrderListQuery) {
  return pageOrders(query, query.fulfillment);
}

export async function getAdminOrder(id: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: orderInclude });
  if (!order) throw new HttpError(404, "Bestellung nicht gefunden.", "NOT_FOUND");
  return presentOrder(order);
}

export async function listDeliveries(query: OrderListQuery) {
  const where = whereSql({ ...query, queue: "all", status: undefined }, "DELIVERY");
  const excluded = textList(SALES_EXCLUDED_STATUSES);
  const pending = textList(DELIVERY_QUEUES.pending);
  const [page, statsRows] = await Promise.all([
    pageOrders({ ...query, fulfillment: undefined }, "DELIVERY"),
    prisma.$queryRaw<{ pending: unknown; active: unknown; completed: unknown; rejected: unknown; cancelled: unknown; averageDistanceKm: unknown; deliveryFeeCents: unknown }[]>`
      SELECT
        COUNT(*) FILTER (WHERE o.status::text IN (${pending})) AS pending,
        COUNT(*) FILTER (WHERE o.status::text = 'OUT_FOR_DELIVERY') AS active,
        COUNT(*) FILTER (WHERE o.status::text = 'COMPLETED') AS completed,
        COUNT(*) FILTER (WHERE o.status::text = 'REJECTED') AS rejected,
        COUNT(*) FILTER (WHERE o.status::text = 'CANCELLED') AS cancelled,
        AVG(o."distanceKm") FILTER (WHERE o.status::text NOT IN (${excluded}) AND o."distanceKm" IS NOT NULL) AS "averageDistanceKm",
        COALESCE(SUM(o."deliveryFeeCents") FILTER (WHERE o.status::text NOT IN (${excluded})), 0) AS "deliveryFeeCents"
      FROM "Order" o
      WHERE ${where}
    `,
  ]);
  const stats = statsRows[0];
  const average = stats?.averageDistanceKm == null ? null : Number(stats.averageDistanceKm);
  return {
    ...page,
    stats: {
      pending: Number(stats?.pending ?? 0),
      active: Number(stats?.active ?? 0),
      completed: Number(stats?.completed ?? 0),
      rejected: Number(stats?.rejected ?? 0),
      cancelled: Number(stats?.cancelled ?? 0),
      averageDistanceKm: average == null || Number.isNaN(average) ? null : Math.round(average * 10) / 10,
      deliveryFeeCents: Number(stats?.deliveryFeeCents ?? 0),
    },
  };
}
