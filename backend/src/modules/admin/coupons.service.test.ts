import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { HttpError } from "../../utils/http.js";
import { couponCustomerKey, couponDiscount, rethrowCouponWrite } from "./coupons.service.js";

describe("coupon math", () => {
  it("caps a discount at the subtotal and keeps the result non-negative", () => {
    expect(couponDiscount({ type: "FIXED", percentOff: null, amountOffCents: 50_000, minimumSubtotalCents: 0 }, 1200)).toBe(1200);
    expect(couponDiscount({ type: "PERCENT", percentOff: 10, amountOffCents: null, minimumSubtotalCents: 0 }, 1999)).toBe(199);
  });

  it("rejects a subtotal below the coupon minimum", () => {
    expect(() => couponDiscount({ type: "FIXED", percentOff: null, amountOffCents: 100, minimumSubtotalCents: 5000 }, 1000)).toThrow(HttpError);
  });

  it("turns a duplicate coupon code into a conflict instead of an internal error", () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
    expect(() => rethrowCouponWrite(duplicate)).toThrow(HttpError);
    try {
      rethrowCouponWrite(duplicate);
    } catch (error) {
      expect(error).toMatchObject({ status: 409, code: "COUPON_CODE" });
    }
  });

  it("groups a customer by account or phone digits", () => {
    expect(couponCustomerKey({ userId: "user-1", phone: "000", email: "a@b.c" })).toBe("user:user-1");
    expect(couponCustomerKey({ phone: "07253 123456" })).toBe("phone:07253123456");
  });
});
