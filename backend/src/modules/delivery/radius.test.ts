import { distanceKm, withinDeliveryRadius } from "@pizzablitz/shared";
import { describe, expect, it } from "vitest";

const shop = { latitude: 49.2187392, longitude: 8.7126137 };

describe("delivery radius", () => {
  it("treats the shop itself as inside the radius", () => {
    expect(distanceKm(shop, shop)).toBe(0);
    expect(withinDeliveryRadius(shop, shop)).toBe(true);
  });

  it("keeps a point about 10 km north inside the radius", () => {
    const nearby = { latitude: shop.latitude + 10 / 111.32, longitude: shop.longitude };
    expect(distanceKm(shop, nearby)).toBeGreaterThan(9);
    expect(distanceKm(shop, nearby)).toBeLessThan(11);
    expect(withinDeliveryRadius(shop, nearby)).toBe(true);
  });

  it("rejects a point about 30 km north", () => {
    const far = { latitude: shop.latitude + 30 / 111.32, longitude: shop.longitude };
    expect(withinDeliveryRadius(shop, far)).toBe(false);
  });
});
