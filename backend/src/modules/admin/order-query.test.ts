import { describe, expect, it } from "vitest";
import { DELIVERY_QUEUES, searchClauses } from "./order-query.js";
import { OPEN_ORDER_STATUSES } from "./reporting.js";

describe("order query filters", () => {
  it("covers every delivery outcome exactly once", () => {
    const listed = Object.values(DELIVERY_QUEUES).flat();
    expect(new Set(listed).size).toBe(listed.length);
    expect(listed.sort()).toEqual(["ACCEPTED", "CANCELLED", "COMPLETED", "OUT_FOR_DELIVERY", "PENDING", "PREPARING", "READY_FOR_PICKUP", "REJECTED"].sort());
    expect(DELIVERY_QUEUES.pending).toEqual(OPEN_ORDER_STATUSES.filter((status) => status !== "OUT_FOR_DELIVERY"));
    expect(DELIVERY_QUEUES.active).toEqual(["OUT_FOR_DELIVERY"]);
  });

  it("searches an order number, a name, and the digits of a phone number", () => {
    const text = (clause: { strings: string[] }) => clause.strings.join(" ");
    const orderNumber = searchClauses("PB-0014").map(text);
    const phone = searchClauses("07253 123456").map(text);
    const name = searchClauses("Anna").map(text);
    expect(orderNumber.some((clause) => clause.includes("publicNumber"))).toBe(true);
    expect(phone.some((clause) => clause.includes("customerPhone"))).toBe(true);
    expect(name.some((clause) => clause.includes("customerFirstName"))).toBe(true);
    expect(name.some((clause) => clause.includes("publicNumber"))).toBe(false);
  });
});
