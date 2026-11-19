import { Prisma } from "@prisma/client";
import { orderCode } from "@pizzablitz/shared";
import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../utils/http.js";
import {
  BUSINESS_TIME_ZONE,
  COLLECTED_PAYMENT_STATUS,
  OPEN_ORDER_STATUSES,
  SALES_EXCLUDED_STATUSES,
  bucketStarts,
  changeRatio,
  previousWindow,
  resolveBusinessRange,
  utcTimestamp,
  type Granularity,
  type RangePreset,
} from "./reporting.js";

const localCreatedAt = Prisma.sql`((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${BUSINESS_TIME_ZONE})`;

function textList(values: readonly string[]) {
  return Prisma.join(values.map((value) => Prisma.sql`${value}`));
}

const excluded = textList(SALES_EXCLUDED_STATUSES);
const openStatuses = textList(OPEN_ORDER_STATUSES);
const collected = COLLECTED_PAYMENT_STATUS;

function numberFrom(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
}

type SummaryRow = {
  salesCents: unknown;
  salesCount: unknown;
  collectedCents: unknown;
  collectedCount: unknown;
  unpaidCents: unknown;
  unpaidCount: unknown;
  openCount: unknown;
  completedCount: unknown;
  deliveryCount: unknown;
  orderCount: unknown;
};

function summaryQuery(start: string, end: string) {
  return prisma.$queryRaw<SummaryRow[]>`
    SELECT
      COALESCE(SUM(o."totalCents") FILTER (WHERE o.status::text NOT IN (${excluded})), 0) AS "salesCents",
      COUNT(*) FILTER (WHERE o.status::text NOT IN (${excluded})) AS "salesCount",
      COALESCE(SUM(o."totalCents") FILTER (WHERE o.status::text NOT IN (${excluded}) AND p.status::text = ${collected}), 0) AS "collectedCents",
      COUNT(*) FILTER (WHERE o.status::text NOT IN (${excluded}) AND p.status::text = ${collected}) AS "collectedCount",
      COALESCE(SUM(o."totalCents") FILTER (WHERE o.status::text NOT IN (${excluded}) AND COALESCE(p.status::text, 'UNPAID') <> ${collected}), 0) AS "unpaidCents",
      COUNT(*) FILTER (WHERE o.status::text NOT IN (${excluded}) AND COALESCE(p.status::text, 'UNPAID') <> ${collected}) AS "unpaidCount",
      COUNT(*) FILTER (WHERE o.status::text IN (${openStatuses})) AS "openCount",
      COUNT(*) FILTER (WHERE o.status::text = 'COMPLETED') AS "completedCount",
      COUNT(*) FILTER (WHERE o.fulfillment::text = 'DELIVERY' AND o.status::text NOT IN (${excluded})) AS "deliveryCount",
      COUNT(*) AS "orderCount"
    FROM "Order" o
    LEFT JOIN "Payment" p ON p."orderId" = o.id
    WHERE o."createdAt" >= ${start}::timestamp AND o."createdAt" < ${end}::timestamp
  `;
}

function presentSummary(row: SummaryRow | undefined) {
  const salesCount = numberFrom(row?.salesCount);
  const salesCents = numberFrom(row?.salesCents);
  return {
    salesCents,
    salesCount,
    averageOrderCents: salesCount === 0 ? 0 : Math.round(salesCents / salesCount),
    collectedCents: numberFrom(row?.collectedCents),
    collectedCount: numberFrom(row?.collectedCount),
    unpaidCents: numberFrom(row?.unpaidCents),
    unpaidCount: numberFrom(row?.unpaidCount),
    openCount: numberFrom(row?.openCount),
    completedCount: numberFrom(row?.completedCount),
    deliveryCount: numberFrom(row?.deliveryCount),
    orderCount: numberFrom(row?.orderCount),
  };
}

type SeriesRow = { bucket: string; salesCents: unknown; collectedCents: unknown; unpaidCents: unknown; salesCount: unknown; voidCount: unknown };
type FulfillmentRow = { fulfillment: string; count: unknown; salesCents: unknown };
type ProductRow = { name: string; sku: string; quantity: unknown; salesCents: unknown };
type CategoryRow = { name: string | null; salesCents: unknown };
type StatusRow = { status: string; count: unknown };
type HourRow = { hour: number; count: unknown };
type QueueRow = { acceptance: unknown; preparation: unknown; ready: unknown; delivery: unknown };
type OrderRow = {
  id: string;
  publicNumber: number;
  status: string;
  fulfillment: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  totalCents: number;
  createdAt: Date;
};

function presentOrder(order: OrderRow) {
  return {
    id: order.id,
    publicNumber: order.publicNumber,
    orderCode: orderCode(order.publicNumber),
    status: order.status,
    fulfillment: order.fulfillment,
    customerFirstName: order.customerFirstName,
    customerLastName: order.customerLastName,
    customerPhone: order.customerPhone,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
  };
}

export async function getAnalytics(input: { preset: RangePreset; from?: string; to?: string; granularity: Granularity }) {
  let range;
  try {
    range = resolveBusinessRange(input);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "Der Zeitraum ist ungültig.", "BAD_RANGE");
  }
  const previous = previousWindow(range, input.preset);
  const currentStart = utcTimestamp(range.start);
  const currentEnd = utcTimestamp(range.end);
  const previousStart = utcTimestamp(previous.start);
  const previousEnd = utcTimestamp(previous.end);
  const bucket = input.granularity === "week" ? "week" : input.granularity === "month" ? "month" : "day";

  const [currentRows, previousRows, seriesRows, fulfillmentRows, productRows, categoryRows, statusRows, hourRows, queueRows, pendingRows, latestRows] = await Promise.all([
    summaryQuery(currentStart, currentEnd),
    summaryQuery(previousStart, previousEnd),
    prisma.$queryRaw<SeriesRow[]>`
      SELECT
        to_char(date_trunc(${bucket}::text, ${localCreatedAt}), 'YYYY-MM-DD') AS bucket,
        COALESCE(SUM(o."totalCents") FILTER (WHERE o.status::text NOT IN (${excluded})), 0) AS "salesCents",
        COALESCE(SUM(o."totalCents") FILTER (WHERE o.status::text NOT IN (${excluded}) AND p.status::text = ${collected}), 0) AS "collectedCents",
        COALESCE(SUM(o."totalCents") FILTER (WHERE o.status::text NOT IN (${excluded}) AND COALESCE(p.status::text, 'UNPAID') <> ${collected}), 0) AS "unpaidCents",
        COUNT(*) FILTER (WHERE o.status::text NOT IN (${excluded})) AS "salesCount",
        COUNT(*) FILTER (WHERE o.status::text IN (${excluded})) AS "voidCount"
      FROM "Order" o
      LEFT JOIN "Payment" p ON p."orderId" = o.id
      WHERE o."createdAt" >= ${currentStart}::timestamp AND o."createdAt" < ${currentEnd}::timestamp
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<FulfillmentRow[]>`
      SELECT o.fulfillment::text AS fulfillment, COUNT(*) AS count, COALESCE(SUM(o."totalCents"), 0) AS "salesCents"
      FROM "Order" o
      WHERE o."createdAt" >= ${currentStart}::timestamp AND o."createdAt" < ${currentEnd}::timestamp
        AND o.status::text NOT IN (${excluded})
      GROUP BY o.fulfillment
    `,
    prisma.$queryRaw<ProductRow[]>`
      SELECT oi."productName" AS name, oi.sku, SUM(oi.quantity) AS quantity, COALESCE(SUM(oi."lineTotalCents"), 0) AS "salesCents"
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."createdAt" >= ${currentStart}::timestamp AND o."createdAt" < ${currentEnd}::timestamp
        AND o.status::text NOT IN (${excluded})
      GROUP BY oi."productName", oi.sku
      ORDER BY SUM(oi.quantity) DESC, SUM(oi."lineTotalCents") DESC
      LIMIT 8
    `,
    prisma.$queryRaw<CategoryRow[]>`
      SELECT COALESCE(cat.name, 'Ohne Kategorie') AS name, COALESCE(SUM(oi."lineTotalCents"), 0) AS "salesCents"
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      LEFT JOIN LATERAL (
        SELECT c.name
        FROM "Product" p
        JOIN "Category" c ON c.id = p."categoryId"
        WHERE p.sku = oi.sku AND p.name = oi."productName"
        ORDER BY p.id
        LIMIT 1
      ) cat ON true
      WHERE o."createdAt" >= ${currentStart}::timestamp AND o."createdAt" < ${currentEnd}::timestamp
        AND o.status::text NOT IN (${excluded})
      GROUP BY COALESCE(cat.name, 'Ohne Kategorie')
      ORDER BY SUM(oi."lineTotalCents") DESC
      LIMIT 8
    `,
    prisma.$queryRaw<StatusRow[]>`
      SELECT o.status::text AS status, COUNT(*) AS count
      FROM "Order" o
      WHERE o."createdAt" >= ${currentStart}::timestamp AND o."createdAt" < ${currentEnd}::timestamp
      GROUP BY o.status
    `,
    prisma.$queryRaw<HourRow[]>`
      SELECT EXTRACT(HOUR FROM ${localCreatedAt})::int AS hour, COUNT(*) AS count
      FROM "Order" o
      WHERE o."createdAt" >= ${currentStart}::timestamp AND o."createdAt" < ${currentEnd}::timestamp
        AND o.status::text NOT IN (${excluded})
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<QueueRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE status::text = 'PENDING') AS acceptance,
        COUNT(*) FILTER (WHERE status::text IN ('ACCEPTED', 'PREPARING')) AS preparation,
        COUNT(*) FILTER (WHERE status::text = 'READY_FOR_PICKUP') AS ready,
        COUNT(*) FILTER (WHERE status::text = 'OUT_FOR_DELIVERY') AS delivery
      FROM "Order"
    `,
    prisma.$queryRaw<OrderRow[]>`
      SELECT id, "publicNumber", status::text AS status, fulfillment::text AS fulfillment,
        "customerFirstName", "customerLastName", "customerPhone", "totalCents", "createdAt"
      FROM "Order"
      WHERE status::text = 'PENDING'
      ORDER BY "createdAt" DESC
      LIMIT 8
    `,
    prisma.$queryRaw<OrderRow[]>`
      SELECT id, "publicNumber", status::text AS status, fulfillment::text AS fulfillment,
        "customerFirstName", "customerLastName", "customerPhone", "totalCents", "createdAt"
      FROM "Order" o
      WHERE o."createdAt" >= ${currentStart}::timestamp AND o."createdAt" < ${currentEnd}::timestamp
      ORDER BY o."createdAt" DESC
      LIMIT 8
    `,
  ]);

  const current = presentSummary(currentRows[0]);
  const prior = presentSummary(previousRows[0]);
  const seriesByBucket = new Map(seriesRows.map((row) => [row.bucket, row]));
  const fulfillment = { delivery: { count: 0, salesCents: 0 }, pickup: { count: 0, salesCents: 0 } };
  for (const row of fulfillmentRows) {
    const target = row.fulfillment === "DELIVERY" ? fulfillment.delivery : fulfillment.pickup;
    target.count = numberFrom(row.count);
    target.salesCents = numberFrom(row.salesCents);
  }
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const row of hourRows) hours[numberFrom(row.hour)] = { hour: numberFrom(row.hour), count: numberFrom(row.count) };
  const queue = queueRows[0];

  return {
    timezone: BUSINESS_TIME_ZONE,
    range: { from: range.from, to: range.to },
    previousRange: { from: previous.from, to: previous.to },
    current,
    comparison: {
      salesCents: changeRatio(current.salesCents, prior.salesCents),
      collectedCents: changeRatio(current.collectedCents, prior.collectedCents),
      unpaidCents: changeRatio(current.unpaidCents, prior.unpaidCents),
      salesCount: changeRatio(current.salesCount, prior.salesCount),
      averageOrderCents: changeRatio(current.averageOrderCents, prior.averageOrderCents),
      openCount: changeRatio(current.openCount, prior.openCount),
      completedCount: changeRatio(current.completedCount, prior.completedCount),
      deliveryCount: changeRatio(current.deliveryCount, prior.deliveryCount),
    },
    series: bucketStarts(range, input.granularity).map((bucketKey) => {
      const row = seriesByBucket.get(bucketKey);
      return {
        bucket: bucketKey,
        salesCents: numberFrom(row?.salesCents),
        collectedCents: numberFrom(row?.collectedCents),
        unpaidCents: numberFrom(row?.unpaidCents),
        salesCount: numberFrom(row?.salesCount),
        voidCount: numberFrom(row?.voidCount),
      };
    }),
    fulfillment,
    topProducts: productRows.map((row) => ({ name: row.name, sku: row.sku, quantity: numberFrom(row.quantity), salesCents: numberFrom(row.salesCents) })),
    categories: categoryRows.map((row) => ({ name: row.name ?? "Ohne Kategorie", salesCents: numberFrom(row.salesCents) })),
    statuses: statusRows.map((row) => ({ status: row.status, count: numberFrom(row.count) })),
    peakHours: hours,
    operations: {
      awaitingAcceptance: numberFrom(queue?.acceptance),
      preparation: numberFrom(queue?.preparation),
      ready: numberFrom(queue?.ready),
      outForDelivery: numberFrom(queue?.delivery),
    },
    pending: pendingRows.map(presentOrder),
    latest: latestRows.map(presentOrder),
  };
}
