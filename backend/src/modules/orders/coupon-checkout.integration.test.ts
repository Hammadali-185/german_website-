import "../../config/load-env.js";
import { berlinClock } from "@pizzablitz/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../database/prisma.js";
import { createOrder } from "./orders.service.js";
import { orderSchema } from "./orders.schema.js";
import { restoreOpeningFixture } from "./test-hours.js";

describe("coupon checkout", () => {
  const stamp = Date.now().toString();
  const keys: string[] = [];
  let restaurant: { id: string; holidayMode: boolean } | null = null;
  let previousHour: { id: string; opens: string; closes: string } | null = null;
  let createdHourId: string | null = null;
  let item: { productId: string; variantId: string; quantity: number; choiceOptionIds: string[]; extraIds: string[] };
  let unitPrice = 0;

  function key(name: string) {
    const value = `coupon-${name}-${stamp}-${keys.length}`;
    keys.push(value);
    return value;
  }

  function order(overrides: Record<string, unknown> = {}) {
    return orderSchema.parse({
      fulfillment: "PICKUP",
      paymentMethod: "CASH",
      customer: { firstName: "Coupon", lastName: "Test", email: "", phone: "07253 222333" },
      address: { street: "", postalCode: "", city: "" },
      notes: "",
      items: [item],
      totalCents: 1,
      discountCents: 999_999,
      ...overrides,
    });
  }

  beforeAll(async () => {
    const found = await prisma.restaurant.findFirst({ include: { hours: true } });
    if (!found) throw new Error("Restaurant ist nicht in der Datenbank.");
    restaurant = found;
    const today = berlinClock(new Date()).day;
    const currentHour = found.hours.find((hour) => hour.day === today);
    if (currentHour) {
      previousHour = { id: currentHour.id, opens: currentHour.opens, closes: currentHour.closes };
      await prisma.openingHours.update({ where: { id: currentHour.id }, data: { opens: "00:00", closes: "23:59" } });
    } else {
      const created = await prisma.openingHours.create({ data: { restaurantId: found.id, day: today, label: today, opens: "00:00", closes: "23:59" } });
      createdHourId = created.id;
    }
    await prisma.restaurant.update({ where: { id: found.id }, data: { holidayMode: false } });
    const variants = await prisma.productVariant.findMany({
      where: { product: { available: true } },
      include: { product: true, choiceGroups: true },
      orderBy: { priceCents: "desc" },
    });
    const variant = variants.find((entry) => entry.choiceGroups.every((group) => !group.required));
    if (!variant) throw new Error("Keine bestellbare Variante.");
    unitPrice = variant.priceCents;
    const quantity = Math.min(50, Math.max(1, Math.ceil(((found.pickupMinimumCents || 0) + 100) / variant.priceCents)));
    item = { productId: variant.productId, variantId: variant.id, quantity, choiceOptionIds: [], extraIds: [] };
  });

  afterAll(async () => {
    try {
      await restoreOpeningFixture({ previousHour, createdHourId, restaurant });
      if (keys.length) await prisma.order.deleteMany({ where: { idempotencyKey: { in: keys } } });
      await prisma.coupon.deleteMany({ where: { code: { startsWith: `P5${stamp.slice(-6)}` } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  async function coupon(suffix: string, data: Record<string, unknown>) {
    return prisma.coupon.create({
      data: {
        code: `P5${stamp.slice(-6)}${suffix}`,
        type: "FIXED",
        amountOffCents: 100,
        minimumSubtotalCents: 0,
        active: true,
        ...data,
      },
    });
  }

  it("ignores a client price and stores the server discount once", async () => {
    const created = await coupon("OK", { type: "PERCENT", percentOff: 10, amountOffCents: null });
    const idempotencyKey = key("once");
    const input = order({ idempotencyKey, couponCode: created.code.toLowerCase() });
    const first = await createOrder(input);
    const second = await createOrder(input);
    const subtotal = unitPrice * item.quantity;
    const discount = Math.floor(subtotal * 0.1);
    expect(first.id).toBe(second.id);
    expect(first.totalCents).toBe(subtotal - discount);
    expect(first.discountCents).toBe(discount);
    expect(first.couponCode).toBe(created.code);
    expect(first.deliveryFeeCents).toBe(0);
    expect(first.payment?.status).toBe("UNPAID");
    expect(await prisma.couponRedemption.count({ where: { couponId: created.id } })).toBe(1);
    const stored = await prisma.orderItem.findFirst({ where: { orderId: first.id } });
    expect(stored?.unitPriceCents).toBe(unitPrice);
  });

  it("rejects invalid, inactive, expired, too-small, exhausted, and repeated customer use", async () => {
    await expect(createOrder(order({ idempotencyKey: key("bad"), couponCode: "NO-SUCH-CODE" }))).rejects.toMatchObject({ code: "COUPON" });
    const inactive = await coupon("OFF", { active: false });
    await expect(createOrder(order({ idempotencyKey: key("off"), couponCode: inactive.code }))).rejects.toMatchObject({ code: "COUPON" });
    const expired = await coupon("EXP", { endsAt: new Date(Date.now() - 60_000) });
    await expect(createOrder(order({ idempotencyKey: key("exp"), couponCode: expired.code }))).rejects.toMatchObject({ code: "COUPON_EXPIRED" });
    const minimum = await coupon("MIN", { minimumSubtotalCents: 5_000_000 });
    await expect(createOrder(order({ idempotencyKey: key("min"), couponCode: minimum.code }))).rejects.toMatchObject({ code: "COUPON_MINIMUM" });
    const limited = await coupon("MAX", { maxRedemptions: 1, amountOffCents: 100 });
    await createOrder(order({ idempotencyKey: key("max1"), couponCode: limited.code, customer: { firstName: "A", lastName: "A", email: "", phone: "07253 300001" } }));
    await expect(createOrder(order({ idempotencyKey: key("max2"), couponCode: limited.code, customer: { firstName: "B", lastName: "B", email: "", phone: "07253 300002" } }))).rejects.toMatchObject({ code: "COUPON_EXHAUSTED" });
    const personal = await coupon("ONE", { perCustomerLimit: 1, amountOffCents: 50 });
    await createOrder(order({ idempotencyKey: key("own1"), couponCode: personal.code, customer: { firstName: "C", lastName: "C", email: "", phone: "07253 300003" } }));
    await expect(createOrder(order({ idempotencyKey: key("own2"), couponCode: personal.code, customer: { firstName: "C", lastName: "C", email: "", phone: "07253 300003" } }))).rejects.toMatchObject({ code: "COUPON_LIMIT" });
    const huge = await coupon("CAP", { amountOffCents: 9_000_000 });
    const capped = await createOrder(order({ idempotencyKey: key("cap"), couponCode: huge.code }));
    expect(capped.discountCents).toBe(unitPrice * item.quantity);
    expect(capped.totalCents).toBe(0);
  });
});
