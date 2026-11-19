import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { getAnalytics } from "./analytics.service.js";
import { csvDocument } from "./csv.js";
import {
  BUSINESS_TIME_ZONE,
  COLLECTED_PAYMENT_STATUS,
  SALES_EXCLUDED_STATUSES,
  addCalendarDays,
  berlinInstant,
  utcTimestamp,
  type Granularity,
  type RangePreset,
} from "./reporting.js";

const excluded = Prisma.join(SALES_EXCLUDED_STATUSES.map((status) => Prisma.sql`${status}`));

function numberFrom(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
}

async function attachDelivery(report: Awaited<ReturnType<typeof getAnalytics>>) {
  const start = utcTimestamp(berlinInstant(report.range.from));
  const end = utcTimestamp(berlinInstant(addCalendarDays(report.range.to, 1)));
  const rows = await prisma.$queryRaw<{
    completed: unknown;
    rejected: unknown;
    cancelled: unknown;
    feeCents: unknown;
    averageDistanceKm: unknown;
    measured: unknown;
    onTime: unknown;
    unmeasured: unknown;
  }[]>`
    SELECT
      COUNT(*) FILTER (WHERE o.fulfillment::text = 'DELIVERY' AND o.status::text = 'COMPLETED') AS completed,
      COUNT(*) FILTER (WHERE o.fulfillment::text = 'DELIVERY' AND o.status::text = 'REJECTED') AS rejected,
      COUNT(*) FILTER (WHERE o.fulfillment::text = 'DELIVERY' AND o.status::text = 'CANCELLED') AS cancelled,
      COALESCE(SUM(o."deliveryFeeCents") FILTER (WHERE o.fulfillment::text = 'DELIVERY' AND o.status::text NOT IN (${excluded})), 0) AS "feeCents",
      COALESCE(AVG(o."distanceKm") FILTER (WHERE o.fulfillment::text = 'DELIVERY' AND o.status::text NOT IN (${excluded}) AND o."distanceKm" IS NOT NULL), 0) AS "averageDistanceKm",
      COUNT(*) FILTER (WHERE o.fulfillment::text = 'DELIVERY' AND o.status::text = 'COMPLETED' AND o."promisedAt" IS NOT NULL AND done."completedAt" IS NOT NULL) AS measured,
      COUNT(*) FILTER (WHERE o.fulfillment::text = 'DELIVERY' AND o.status::text = 'COMPLETED' AND o."promisedAt" IS NOT NULL AND done."completedAt" IS NOT NULL AND done."completedAt" <= o."promisedAt") AS "onTime",
      COUNT(*) FILTER (WHERE o.fulfillment::text = 'DELIVERY' AND o.status::text = 'COMPLETED' AND (o."promisedAt" IS NULL OR done."completedAt" IS NULL)) AS unmeasured
    FROM "Order" o
    LEFT JOIN LATERAL (
      SELECT MIN(e."createdAt") AS "completedAt"
      FROM "OrderStatusEvent" e
      WHERE e."orderId" = o.id AND e.status::text = 'COMPLETED'
    ) done ON true
    WHERE o."createdAt" >= ${start}::timestamp AND o."createdAt" < ${end}::timestamp
  `;
  const row = rows[0];
  const measured = numberFrom(row?.measured);
  const onTime = numberFrom(row?.onTime);
  return {
    ...report,
    voids: {
      rejected: report.statuses.find((status) => status.status === "REJECTED")?.count ?? 0,
      cancelled: report.statuses.find((status) => status.status === "CANCELLED")?.count ?? 0,
    },
    deliveryPerformance: {
      completed: numberFrom(row?.completed),
      rejected: numberFrom(row?.rejected),
      cancelled: numberFrom(row?.cancelled),
      feeCents: numberFrom(row?.feeCents),
      averageDistanceKm: Number(numberFrom(row?.averageDistanceKm).toFixed(2)),
      measured,
      onTime,
      late: measured - onTime,
      unmeasured: numberFrom(row?.unmeasured),
      onTimeRatio: measured === 0 ? null : onTime / measured,
      note: "Pünktlich bedeutet: die erste Abschlusszeit liegt auf oder vor der Zusage, die beim Bestellen gespeichert wurde. Lieferungen ohne Zusage zählen nicht in die Quote.",
    },
  };
}

export async function getReport(input: { preset: RangePreset; from?: string; to?: string; granularity: Granularity }) {
  return attachDelivery(await getAnalytics(input));
}

export async function reportCsv(input: { preset: RangePreset; from?: string; to?: string; granularity: Granularity }) {
  const report = await getReport(input);
  const rows: unknown[][] = [
    ["Bericht", "Pizza Blitz"],
    ["Zeitzone", BUSINESS_TIME_ZONE],
    ["Von", report.range.from],
    ["Bis", report.range.to],
    ["Kassiert bedeutet", COLLECTED_PAYMENT_STATUS],
    [],
    ["Kennzahl", "Cent", "Anzahl"],
    ["Umsatz", report.current.salesCents, report.current.salesCount],
    ["Kassiert", report.current.collectedCents, report.current.collectedCount],
    ["Unbezahlt", report.current.unpaidCents, report.current.unpaidCount],
    ["Bestellungen gesamt", "", report.current.orderCount],
    ["Durchschnittlicher Bestellwert", report.current.averageOrderCents, ""],
    ["Abgelehnt", "", report.voids.rejected],
    ["Storniert", "", report.voids.cancelled],
    [],
    ["Zeitraum", "Umsatz Cent", "Kassiert Cent", "Unbezahlt Cent", "Bestellungen"],
    ...report.series.map((row) => [row.bucket, row.salesCents, row.collectedCents, row.unpaidCents, row.salesCount]),
    [],
    ["Erfüllung", "Anzahl", "Umsatz Cent"],
    ["Lieferung", report.fulfillment.delivery.count, report.fulfillment.delivery.salesCents],
    ["Abholung", report.fulfillment.pickup.count, report.fulfillment.pickup.salesCents],
    [],
    ["Produkt", "Nummer", "Menge", "Umsatz Cent"],
    ...report.topProducts.map((row) => [row.name, row.sku, row.quantity, row.salesCents]),
    [],
    ["Kategorie", "Umsatz Cent"],
    ...report.categories.map((row) => [row.name, row.salesCents]),
    [],
    ["Lieferleistung", "Wert"],
    ["Abgeschlossene Lieferungen", report.deliveryPerformance.completed],
    ["Abgelehnte Lieferungen", report.deliveryPerformance.rejected],
    ["Stornierte Lieferungen", report.deliveryPerformance.cancelled],
    ["Liefergebühren Cent", report.deliveryPerformance.feeCents],
    ["Durchschnittliche Entfernung km", report.deliveryPerformance.averageDistanceKm],
    ["Pünktlich gemessen", report.deliveryPerformance.measured],
    ["Davon pünktlich", report.deliveryPerformance.onTime],
    ["Davon zu spät", report.deliveryPerformance.late],
    ["Abgeschlossen ohne Zusage", report.deliveryPerformance.unmeasured],
    ["Hinweis", report.deliveryPerformance.note],
  ];
  return { filename: `bericht-${report.range.from}-${report.range.to}.csv`, body: csvDocument(rows) };
}
