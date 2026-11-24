import "../../config/load-env.js";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../database/prisma.js";
import { getReport } from "../admin/reports.service.js";
import { collectCashPayment, updateOrderStatus } from "./orders.service.js";

describe("cash collection and delivery punctuality", () => {
  const stamp = `ops-${Date.now()}`;
  const keys = ["cash", "again", "card", "void", "on-time", "late", "none", "race"].map((name) => `${stamp}-${name}`);

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { idempotencyKey: { in: keys } } });
    await prisma.$disconnect();
  });

  async function order(key: string, data: Record<string, unknown> = {}) {
    return prisma.order.create({
      data: {
        fulfillment: "DELIVERY",
        status: "COMPLETED",
        customerFirstName: "Kasse",
        customerLastName: stamp,
        customerPhone: "07253000111",
        subtotalCents: 1000,
        deliveryFeeCents: 200,
        totalCents: 1200,
        minimumOrderCents: 0,
        distanceKm: 3,
        idempotencyKey: key,
        payment: { create: { method: "CASH", status: "UNPAID" } },
        ...data,
      },
    });
  }

  it("marks only an open cash order as paid and does not repeat the timestamp", async () => {
    const cash = await order(keys[0], { fulfillment: "PICKUP", deliveryFeeCents: 0, totalCents: 1000, status: "COMPLETED" });
    const first = await collectCashPayment(cash.id);
    const second = await collectCashPayment(cash.id);
    expect(first.payment?.status).toBe("PAID");
    expect(first.payment?.paidAt).toBeTruthy();
    expect(second.payment?.paidAt).toEqual(first.payment?.paidAt);
    const race = await order(keys[7], { fulfillment: "PICKUP", deliveryFeeCents: 0, totalCents: 1000, status: "COMPLETED" });
    const [left, right] = await Promise.all([collectCashPayment(race.id), collectCashPayment(race.id)]);
    expect(left.payment?.status).toBe("PAID");
    expect(left.payment?.paidAt).toEqual(right.payment?.paidAt);
    const stored = await prisma.payment.findUnique({ where: { orderId: race.id } });
    expect(stored?.paidAt?.toISOString()).toBe(left.payment?.paidAt?.toISOString());
    const card = await order(keys[2], { payment: { create: { method: "CARD", status: "UNPAID" } } });
    await expect(collectCashPayment(card.id)).rejects.toMatchObject({ code: "CASH_ONLY" });
    const rejected = await order(keys[3], { status: "REJECTED" });
    await expect(collectCashPayment(rejected.id)).rejects.toMatchObject({ code: "ORDER_CLOSED" });
  });

  it("keeps the earliest completion time when an order is completed again", async () => {
    const created = await order(keys[1], { status: "PENDING", fulfillment: "PICKUP", deliveryFeeCents: 0, totalCents: 1000 });
    await updateOrderStatus(created.id, "COMPLETED");
    const first = await prisma.orderStatusEvent.findFirst({ where: { orderId: created.id, status: "COMPLETED" }, orderBy: { createdAt: "asc" } });
    await updateOrderStatus(created.id, "PREPARING");
    await updateOrderStatus(created.id, "COMPLETED");
    const events = await prisma.orderStatusEvent.findMany({ where: { orderId: created.id, status: "COMPLETED" }, orderBy: { createdAt: "asc" } });
    expect(events.length).toBe(2);
    expect(events[0]?.createdAt.toISOString()).toBe(first?.createdAt.toISOString());
  });

  it("counts on-time delivery only when a stored promise and completion exist", async () => {
    const before = await getReport({ preset: "today", granularity: "day" });
    const now = new Date();
    const early = new Date(now.getTime() - 60_000);
    await order(keys[4], { promisedAt: new Date(now.getTime() + 60_000), statusEvents: { create: { status: "COMPLETED", createdAt: early } } });
    await order(keys[5], { promisedAt: new Date(now.getTime() - 120_000), statusEvents: { create: { status: "COMPLETED", createdAt: now } } });
    await order(keys[6], { promisedAt: null, statusEvents: { create: { status: "COMPLETED", createdAt: now } } });
    const report = await getReport({ preset: "today", granularity: "day" });
    expect(report.deliveryPerformance.measured).toBe(before.deliveryPerformance.measured + 2);
    expect(report.deliveryPerformance.onTime).toBe(before.deliveryPerformance.onTime + 1);
    expect(report.deliveryPerformance.late).toBe(report.deliveryPerformance.measured - report.deliveryPerformance.onTime);
    expect(report.deliveryPerformance.unmeasured).toBe(before.deliveryPerformance.unmeasured + 1);
  });
});
