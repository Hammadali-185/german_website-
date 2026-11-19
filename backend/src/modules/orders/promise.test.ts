import { describe, expect, it } from "vitest";
import { promisedAtFor } from "./promise.js";

describe("delivery promise", () => {
  const createdAt = new Date("2026-11-19T12:00:00.000Z");

  it("stores no promise until the kitchen and travel settings exist", () => {
    expect(promisedAtFor({ createdAt, fulfillment: "DELIVERY", distanceKm: 4, preparationMinutes: null, deliveryMinutesPerKm: 3 })).toBeNull();
    expect(promisedAtFor({ createdAt, fulfillment: "DELIVERY", distanceKm: null, preparationMinutes: 20, deliveryMinutesPerKm: 3 })).toBeNull();
    expect(promisedAtFor({ createdAt, fulfillment: "DELIVERY", distanceKm: 4.2, preparationMinutes: 20, deliveryMinutesPerKm: null })).toBeNull();
  });

  it("adds preparation and rounded travel minutes for delivery", () => {
    const promised = promisedAtFor({ createdAt, fulfillment: "DELIVERY", distanceKm: 4.2, preparationMinutes: 20, deliveryMinutesPerKm: 3 });
    expect(promised?.toISOString()).toBe("2026-11-19T12:33:00.000Z");
  });

  it("uses only preparation for pickup", () => {
    const promised = promisedAtFor({ createdAt, fulfillment: "PICKUP", distanceKm: null, preparationMinutes: 15, deliveryMinutesPerKm: null });
    expect(promised?.toISOString()).toBe("2026-11-19T12:15:00.000Z");
  });
});
