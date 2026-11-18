import { describe, expect, it } from "vitest";
import { describePaymentMethods } from "../payments/payment-methods.ts";
import { cartItemSchema, orderSchema } from "./orders.schema.ts";

const customer = { firstName: "Ada", lastName: "Lovelace", email: "", phone: "07253 123456" };
const item = { productId: "product", variantId: "variant", quantity: 1, choiceOptionIds: [], extraIds: [] };

describe("checkout validation", () => {
  it("accepts an empty email and a valid phone number", () => {
    const parsed = orderSchema.parse({
      fulfillment: "PICKUP",
      customer,
      address: { street: "", postalCode: "", city: "" },
      notes: "",
      paymentMethod: "CASH",
      items: [item],
    });
    expect(parsed.customer.email).toBe("");
    expect(parsed.customer.phone).toBe("07253 123456");
  });

  it("accepts a valid email", () => {
    const parsed = orderSchema.parse({
      fulfillment: "PICKUP",
      customer: { ...customer, email: "Guest@Example.com" },
      address: {},
      paymentMethod: "CASH",
      items: [item],
    });
    expect(parsed.customer.email).toBe("Guest@Example.com");
  });

  it("rejects an invalid email, an empty name, and a phone number without enough digits", () => {
    expect(() =>
      orderSchema.parse({
        fulfillment: "PICKUP",
        customer: { ...customer, email: "not-an-email" },
        address: {},
        paymentMethod: "CASH",
        items: [item],
      }),
    ).toThrow();
    expect(() =>
      orderSchema.parse({
        fulfillment: "PICKUP",
        customer: { ...customer, firstName: "   " },
        address: {},
        paymentMethod: "CASH",
        items: [item],
      }),
    ).toThrow();
    expect(() =>
      orderSchema.parse({
        fulfillment: "PICKUP",
        customer: { ...customer, phone: "123" },
        address: {},
        paymentMethod: "CASH",
        items: [item],
      }),
    ).toThrow();
  });

  it("drops prices submitted by the client", () => {
    const parsed = cartItemSchema.parse({ ...item, priceCents: 1, lineTotalCents: 1 });
    expect(parsed).not.toHaveProperty("priceCents");
    expect(parsed).not.toHaveProperty("lineTotalCents");
    const order = orderSchema.parse({
      fulfillment: "PICKUP",
      customer,
      address: {},
      paymentMethod: "CASH",
      items: [item],
      totalCents: 1,
      deliveryFeeCents: 0,
    });
    expect(order).not.toHaveProperty("totalCents");
    expect(order).not.toHaveProperty("deliveryFeeCents");
  });

  it("keeps cash available and the online methods unavailable without credentials", () => {
    const methods = describePaymentMethods({ paypal: false, card: false, sofort: false });
    expect(methods.find((method) => method.method === "CASH")?.available).toBe(true);
    expect(methods.filter((method) => method.method !== "CASH").every((method) => method.available === false)).toBe(true);
  });
});
