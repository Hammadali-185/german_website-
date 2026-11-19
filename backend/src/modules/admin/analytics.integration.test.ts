import "../../config/load-env.js";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../database/prisma.js";
import { getAnalytics } from "./analytics.service.js";
import { listAdminOrders, listDeliveries } from "./order-query.js";
import { OPEN_ORDER_STATUSES, addCalendarDays, berlinDate, berlinInstant } from "./reporting.js";

describe("admin analytics", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("aggregates the Berlin day without returning order rows", async () => {
    const report = await getAnalytics({ preset: "today", granularity: "day" });
    expect(report.timezone).toBe("Europe/Berlin");
    expect(report.series).toHaveLength(1);
    expect(report.current.salesCents).toBeGreaterThanOrEqual(0);
    expect(report.current.collectedCents + report.current.unpaidCents).toBe(report.current.salesCents);
    expect(report.peakHours).toHaveLength(24);
    expect(report.pending.length).toBeLessThanOrEqual(8);
    expect(report.operations.awaitingAcceptance).toBeGreaterThanOrEqual(report.pending.length);
    expect(OPEN_ORDER_STATUSES).toEqual(["PENDING", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"]);
  });

  it("matches inserted orders and Berlin daylight-saving boundaries", async () => {
    const spring = await prisma.$queryRaw<{ day: string }[]>`
      SELECT to_char(((TIMESTAMP '2026-03-29 22:30:00' AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Berlin'), 'YYYY-MM-DD') AS day
    `;
    const beforeChange = await prisma.$queryRaw<{ day: string }[]>`
      SELECT to_char(((TIMESTAMP '2026-03-29 21:30:00' AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Berlin'), 'YYYY-MM-DD') AS day
    `;
    const overlap = await prisma.$queryRaw<{ stamp: string }[]>`
      SELECT to_char(((TIMESTAMP '2026-10-25 00:30:00' AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Berlin'), 'YYYY-MM-DD HH24:MI') AS stamp
    `;
    expect(spring[0]?.day).toBe("2026-03-30");
    expect(beforeChange[0]?.day).toBe("2026-03-29");
    expect(overlap[0]?.stamp).toBe("2026-10-25 02:30");

    const marker = `PhaseReview${Date.now()}`;
    const phone = "07253 999001";
    const rows = [
      ["PENDING", "DELIVERY", "UNPAID", 1000],
      ["ACCEPTED", "DELIVERY", "UNPAID", 1100],
      ["PREPARING", "DELIVERY", "UNPAID", 1200],
      ["READY_FOR_PICKUP", "DELIVERY", "UNPAID", 1300],
      ["OUT_FOR_DELIVERY", "DELIVERY", "UNPAID", 1400],
      ["COMPLETED", "PICKUP", "PAID", 1500],
      ["REJECTED", "DELIVERY", "UNPAID", 1600],
      ["CANCELLED", "DELIVERY", "PAID", 1700],
    ] as const;
    const keys = rows.map((row, index) => `phase2-review-${marker}-${index}-${row[0]}`);
    const before = await getAnalytics({ preset: "today", granularity: "day" });
    try {
      for (const [index, [status, fulfillment, payment, total]] of rows.entries()) {
        await prisma.order.create({
          data: {
            fulfillment,
            status,
            customerFirstName: "Review",
            customerLastName: marker,
            customerPhone: phone,
            subtotalCents: total,
            deliveryFeeCents: fulfillment === "DELIVERY" ? 200 : 0,
            totalCents: total,
            minimumOrderCents: 0,
            idempotencyKey: keys[index],
            street: "Testweg 1",
            postalCode: "76684",
            city: "Östringen",
            distanceKm: fulfillment === "DELIVERY" ? 2.5 : null,
            payment: { create: { method: "CASH", status: payment } },
          },
        });
      }
      const after = await getAnalytics({ preset: "today", granularity: "day" });
      expect(after.current.salesCents - before.current.salesCents).toBe(7500);
      expect(after.current.collectedCents - before.current.collectedCents).toBe(1500);
      expect(after.current.unpaidCents - before.current.unpaidCents).toBe(6000);
      expect(after.current.openCount - before.current.openCount).toBe(5);
      const found = await listAdminOrders({ q: "07253999001", sort: "newest", page: 1, pageSize: 20 });
      expect(found.items.some((order) => order.customerLastName === marker)).toBe(true);
      const deliveries = await listDeliveries({ q: marker, sort: "newest", page: 1, pageSize: 20, queue: "active" });
      expect(deliveries.items.every((order) => order.fulfillment === "DELIVERY" && order.status === "OUT_FOR_DELIVERY")).toBe(true);
      expect(deliveries.stats.active).toBeGreaterThanOrEqual(1);
      expect(deliveries.stats.rejected).toBeGreaterThanOrEqual(1);
    } finally {
      await prisma.order.deleteMany({ where: { idempotencyKey: { in: keys } } });
    }
  });

  it("pages and filters in the database and keeps voided or pickup fees out of delivery totals", async () => {
    const marker = `Bounds${Date.now()}`;
    const today = berlinDate(new Date());
    const yesterday = addCalendarDays(today, -1);
    const keys = ["pickup", "rejected", "cancelled", "today", "yesterday"].map((name) => `phase3-${marker}-${name}`);
    const base = {
      customerFirstName: "Bounds",
      customerLastName: marker,
      customerPhone: "017600011122",
      subtotalCents: 1000,
      minimumOrderCents: 0,
      street: "Testweg 1",
      postalCode: "76684",
      city: "Östringen",
      payment: { create: { method: "CASH" as const, status: "UNPAID" as const } },
    };
    try {
      await prisma.order.create({ data: { ...base, fulfillment: "PICKUP", status: "COMPLETED", deliveryFeeCents: 900, totalCents: 1900, idempotencyKey: keys[0] } });
      await prisma.order.create({ data: { ...base, fulfillment: "DELIVERY", status: "REJECTED", deliveryFeeCents: 700, totalCents: 1700, distanceKm: 3, idempotencyKey: keys[1] } });
      await prisma.order.create({ data: { ...base, fulfillment: "DELIVERY", status: "CANCELLED", deliveryFeeCents: 500, totalCents: 1500, distanceKm: 3, idempotencyKey: keys[2] } });
      await prisma.order.create({ data: { ...base, fulfillment: "DELIVERY", status: "COMPLETED", deliveryFeeCents: 300, totalCents: 1300, distanceKm: 2, idempotencyKey: keys[3] } });
      await prisma.order.create({ data: { ...base, fulfillment: "DELIVERY", status: "COMPLETED", deliveryFeeCents: 111, totalCents: 1111, distanceKm: 4, createdAt: berlinInstant(yesterday, "12:00:00"), idempotencyKey: keys[4] } });
      const deliveries = await listDeliveries({ q: marker, sort: "newest", page: 1, pageSize: 20, queue: "all" });
      expect(deliveries.items.every((order) => order.fulfillment === "DELIVERY")).toBe(true);
      expect(deliveries.stats.deliveryFeeCents).toBe(411);
      const fromToday = await listAdminOrders({ q: marker, from: today, sort: "newest", page: 1, pageSize: 20 });
      const untilYesterday = await listAdminOrders({ q: marker, to: yesterday, sort: "newest", page: 1, pageSize: 20 });
      expect(fromToday.total).toBe(4);
      expect(untilYesterday.total).toBe(1);
      const first = await listAdminOrders({ q: marker, sort: "oldest", page: 1, pageSize: 1 });
      const second = await listAdminOrders({ q: marker, sort: "oldest", page: 2, pageSize: 1 });
      expect(first.total).toBe(5);
      expect(first.items).toHaveLength(1);
      expect(second.items).toHaveLength(1);
      expect(first.items[0]?.id).not.toBe(second.items[0]?.id);
    } finally {
      await prisma.order.deleteMany({ where: { idempotencyKey: { in: keys } } });
    }
  });
});
