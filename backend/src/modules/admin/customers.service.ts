import { Prisma } from "@prisma/client";
import { orderCode } from "@pizzablitz/shared";
import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../utils/http.js";
import { SALES_EXCLUDED_STATUSES } from "./reporting.js";

export function customerGroupKey(phone: string, orderId: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 3 ? digits : `guest:${orderId}`;
}

function customerCte() {
  const excluded = Prisma.join(SALES_EXCLUDED_STATUSES.map((status) => Prisma.sql`${status}`));
  return Prisma.sql`
    WITH base AS (
      SELECT o.*,
        CASE
          WHEN length(regexp_replace(o."customerPhone", '[^0-9]', '', 'g')) < 3 THEN 'guest:' || o.id
          ELSE regexp_replace(o."customerPhone", '[^0-9]', '', 'g')
        END AS key
      FROM "Order" o
    ),
    latest AS (
      SELECT DISTINCT ON (key)
        key, id AS "latestOrderId", "publicNumber", "customerFirstName", "customerLastName", "customerPhone", "customerEmail", "userId", "createdAt" AS "latestAt"
      FROM base
      ORDER BY key, "createdAt" DESC, id DESC
    ),
    agg AS (
      SELECT key, COUNT(*) AS "orderCount",
        COALESCE(SUM("totalCents") FILTER (WHERE status::text NOT IN (${excluded})), 0) AS "spendingCents"
      FROM base
      GROUP BY key
    )
  `;
}

function sortSql(sort: string) {
  if (sort === "spending") return Prisma.sql`agg."spendingCents" DESC, latest.key ASC`;
  if (sort === "orders") return Prisma.sql`agg."orderCount" DESC, latest.key ASC`;
  if (sort === "name") return Prisma.sql`latest."customerLastName" ASC, latest."customerFirstName" ASC`;
  if (sort === "oldest") return Prisma.sql`latest."latestAt" ASC, latest.key ASC`;
  return Prisma.sql`latest."latestAt" DESC, latest.key ASC`;
}

function searchSql(q: string | undefined) {
  const term = (q ?? "").trim().slice(0, 80).replace(/[%_]/g, "");
  if (!term) return Prisma.sql`TRUE`;
  const like = `%${term}%`;
  const digits = term.replace(/\D/g, "");
  const parts = [
    Prisma.sql`latest."customerFirstName" ILIKE ${like}`,
    Prisma.sql`latest."customerLastName" ILIKE ${like}`,
    Prisma.sql`(latest."customerFirstName" || ' ' || latest."customerLastName") ILIKE ${like}`,
    Prisma.sql`COALESCE(latest."customerEmail", '') ILIKE ${like}`,
  ];
  if (digits.length >= 3) parts.push(Prisma.sql`latest.key LIKE ${`%${digits}%`}`);
  return Prisma.sql`(${Prisma.join(parts, " OR ")})`;
}

type CustomerRow = {
  key: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail: string | null;
  userId: string | null;
  accountEmail: string | null;
  accountFirstName: string | null;
  accountLastName: string | null;
  orderCount: unknown;
  spendingCents: unknown;
  latestAt: Date;
  latestOrderId: string;
  publicNumber: number;
};

export async function listCustomers(query: { q?: string; sort: string; page: number; pageSize: number }) {
  const offset = (query.page - 1) * query.pageSize;
  const [countRows, rows] = await Promise.all([
    prisma.$queryRaw<{ count: unknown }[]>`${customerCte()} SELECT COUNT(*) AS count FROM latest JOIN agg USING (key) WHERE ${searchSql(query.q)}`,
    prisma.$queryRaw<CustomerRow[]>`
      ${customerCte()}
      SELECT latest.key, latest."customerFirstName", latest."customerLastName", latest."customerPhone", latest."customerEmail",
        latest."userId", u.email AS "accountEmail", u."firstName" AS "accountFirstName", u."lastName" AS "accountLastName",
        agg."orderCount", agg."spendingCents", latest."latestAt", latest."latestOrderId", latest."publicNumber"
      FROM latest
      JOIN agg USING (key)
      LEFT JOIN "User" u ON u.id = latest."userId"
      WHERE ${searchSql(query.q)}
      ORDER BY ${sortSql(query.sort)}
      LIMIT ${query.pageSize} OFFSET ${offset}
    `,
  ]);
  return {
    items: rows.map((row) => ({
      key: row.key,
      firstName: row.customerFirstName,
      lastName: row.customerLastName,
      phone: row.customerPhone,
      email: row.customerEmail,
      orderCount: Number(row.orderCount),
      spendingCents: Number(row.spendingCents),
      latestAt: row.latestAt,
      latestOrderCode: orderCode(row.publicNumber),
      account: row.userId ? { id: row.userId, email: row.accountEmail, firstName: row.accountFirstName, lastName: row.accountLastName } : null,
    })),
    total: Number(countRows[0]?.count ?? 0),
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function customerOrders(key: string, page: number, pageSize: number) {
  if (!/^\d{3,}$/.test(key) && !/^guest:[a-z0-9]+$/i.test(key)) throw new HttpError(400, "Der Kunde ist ungültig.", "CUSTOMER");
  const guestId = key.startsWith("guest:") ? key.slice(6) : "";
  const where = guestId
    ? Prisma.sql`o.id = ${guestId}`
    : Prisma.sql`regexp_replace(o."customerPhone", '[^0-9]', '', 'g') = ${key}`;
  const offset = (page - 1) * pageSize;
  const [countRows, idRows] = await Promise.all([
    prisma.$queryRaw<{ count: unknown }[]>`SELECT COUNT(*) AS count FROM "Order" o WHERE ${where}`,
    prisma.$queryRaw<{ id: string }[]>`
      SELECT o.id FROM "Order" o WHERE ${where}
      ORDER BY o."createdAt" DESC, o.id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
  ]);
  const ids = idRows.map((row) => row.id);
  const orders = ids.length
    ? await prisma.order.findMany({
        where: { id: { in: ids } },
        select: {
          id: true, publicNumber: true, status: true, fulfillment: true, totalCents: true, createdAt: true,
          customerFirstName: true, customerLastName: true, customerEmail: true, customerPhone: true,
        },
      })
    : [];
  const byId = new Map(orders.map((order) => [order.id, order]));
  return {
    items: ids.flatMap((id) => {
      const order = byId.get(id);
      return order ? [{ ...order, orderCode: orderCode(order.publicNumber) }] : [];
    }),
    total: Number(countRows[0]?.count ?? 0),
    page,
    pageSize,
  };
}
