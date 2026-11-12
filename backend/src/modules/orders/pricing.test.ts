import { describe, expect, it } from "vitest";
import { assertChoiceSelection, cartLineKey, orderTotalCents, priceLine } from "../../../../shared/src/pricing.ts";
import { isRestaurantOpen, type OpeningHour } from "../../../../shared/src/hours.ts";
import { evaluateFulfillment } from "../../../../shared/src/delivery.ts";
import { describePaymentMethods } from "../payments/payment-methods.ts";
import { cartItemSchema } from "./orders.schema.ts";

const hours: OpeningHour[] = [
  { day: "MONDAY", opens: "15:45", closes: "22:59" },
  { day: "TUESDAY", opens: "15:45", closes: "22:59" },
  { day: "WEDNESDAY", opens: "15:45", closes: "22:59" },
  { day: "THURSDAY", opens: "15:45", closes: "22:59" },
  { day: "FRIDAY", opens: "15:45", closes: "23:59" },
  { day: "SATURDAY", opens: "12:00", closes: "23:59" },
  { day: "SUNDAY", opens: "11:00", closes: "22:59" },
  { day: "HOLIDAY", opens: "11:00", closes: "22:59" },
];

describe("priceLine", () => {
  it("uses the selected size price", () => {
    const line = priceLine({ basePriceCents: 800, choices: [], extras: [], includedExtraCount: 0, quantity: 2 });
    expect(line).toMatchObject({ unitPriceCents: 800, lineTotalCents: 1600 });
  });

  it("makes the first included extras free and charges the rest in selection order", () => {
    const line = priceLine({
      basePriceCents: 2850,
      choices: [{ priceCents: 0 }, { priceCents: 0 }],
      extras: [{ priceCents: 200 }, { priceCents: 450 }, { priceCents: 100 }, { priceCents: 250 }, { priceCents: 200 }],
      includedExtraCount: 4,
      quantity: 1,
    });
    expect(line.freeExtraCount).toBe(4);
    expect(line.chargedExtraCents).toBe(200);
    expect(line.unitPriceCents).toBe(3050);
  });

  it("adds choice prices", () => {
    const line = priceLine({
      basePriceCents: 1100,
      choices: [{ priceCents: 150 }],
      extras: [{ priceCents: 80 }],
      includedExtraCount: 0,
      quantity: 1,
    });
    expect(line.unitPriceCents).toBe(1330);
  });

  it("rejects an invalid quantity", () => {
    expect(() => priceLine({ basePriceCents: 100, choices: [], extras: [], includedExtraCount: 0, quantity: 0 })).toThrow();
  });

  it("requires exactly one option in each required group", () => {
    const groups = [{ name: "Salat", required: true, optionIds: ["a", "b"] }];
    expect(() => assertChoiceSelection(groups, [])).toThrow(/Salat/);
    expect(() => assertChoiceSelection(groups, ["a", "b"])).toThrow(/nur eine Auswahl/);
    expect(() => assertChoiceSelection(groups, ["nope"])).toThrow(/nicht zu diesem Produkt/);
    expect(() => assertChoiceSelection(groups, ["a"])).not.toThrow();
  });

  it("snapshots the order total from line totals plus a stored fee", () => {
    expect(orderTotalCents([1600, 3050], 0)).toBe(4650);
    expect(orderTotalCents([1600, 3050], 250)).toBe(4900);
  });

  it("keeps different customizations distinct", () => {
    const plain = cartLineKey({ productId: "p", variantId: "v", choiceIds: [], extraIds: ["a"] });
    const other = cartLineKey({ productId: "p", variantId: "v", choiceIds: [], extraIds: ["a", "b"] });
    expect(plain).not.toBe(other);
  });
});

describe("opening hours", () => {
  it("follows the published Berlin schedule", () => {
    expect(isRestaurantOpen(new Date("2026-11-11T16:00:00+01:00"), hours)).toBe(true);
    expect(isRestaurantOpen(new Date("2026-11-11T10:00:00+01:00"), hours)).toBe(false);
    expect(isRestaurantOpen(new Date("2026-11-13T23:30:00+01:00"), hours)).toBe(true);
    expect(isRestaurantOpen(new Date("2026-11-14T11:00:00+01:00"), hours)).toBe(false);
    expect(isRestaurantOpen(new Date("2026-11-15T11:00:00+01:00"), hours)).toBe(true);
  });

  it("uses holiday hours only when holiday mode is on", () => {
    expect(isRestaurantOpen(new Date("2026-11-11T12:00:00+01:00"), hours, true)).toBe(true);
    expect(isRestaurantOpen(new Date("2026-11-11T12:00:00+01:00"), hours, false)).toBe(false);
  });
});

describe("delivery rules", () => {
  const area = { postalCode: "76684", locality: "Östringen Zentrum", minimumOrderCents: 1200, deliveryFeeCents: null as number | null };

  it("does not invent a delivery fee", () => {
    const decision = evaluateFulfillment({ fulfillment: "DELIVERY", subtotalCents: 2000, area, pickupMinimumCents: 0 });
    expect(decision.ok).toBe(true);
    if (decision.ok) expect(decision.deliveryFeeCents).toBe(0);
  });

  it("enforces the published minimum and rejects unknown areas", () => {
    const low = evaluateFulfillment({ fulfillment: "DELIVERY", subtotalCents: 500, area, pickupMinimumCents: 0 });
    expect(low.ok).toBe(false);
    const missing = evaluateFulfillment({ fulfillment: "DELIVERY", subtotalCents: 5000, area: null, pickupMinimumCents: 0 });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("AREA");
  });

  it("charges a fee only when one is stored", () => {
    const decision = evaluateFulfillment({
      fulfillment: "DELIVERY",
      subtotalCents: 2000,
      area: { ...area, deliveryFeeCents: 250 },
      pickupMinimumCents: 0,
    });
    expect(decision.ok && decision.deliveryFeeCents).toBe(250);
  });

  it("allows pickup without a delivery area", () => {
    const decision = evaluateFulfillment({ fulfillment: "PICKUP", subtotalCents: 100, area: null, pickupMinimumCents: 0 });
    expect(decision.ok).toBe(true);
  });
});

describe("client prices", () => {
  it("drops a price sent by the browser before the server prices the line", () => {
    const parsed = cartItemSchema.parse({
      productId: "product",
      variantId: "variant",
      quantity: 1,
      priceCents: 1,
      unitPriceCents: 1,
    });
    expect(parsed).toEqual({
      productId: "product",
      variantId: "variant",
      quantity: 1,
      choiceOptionIds: [],
      extraIds: [],
    });
  });
});

describe("payment methods", () => {
  it("keeps cash available and does not pretend online payments are configured", () => {
    const methods = describePaymentMethods({ paypal: false, card: false, sofort: false });
    expect(methods.find((method) => method.method === "CASH")?.available).toBe(true);
    expect(methods.filter((method) => method.method !== "CASH").every((method) => method.available === false)).toBe(true);
  });
});
