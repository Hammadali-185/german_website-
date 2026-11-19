-- Additive coupon tables and order snapshot columns. Existing totals stay unchanged.
CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED');

ALTER TABLE "Order" ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "couponCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "couponSummary" TEXT;

CREATE TABLE "Coupon" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" "CouponType" NOT NULL,
  "percentOff" INTEGER,
  "amountOffCents" INTEGER,
  "minimumSubtotalCents" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "maxRedemptions" INTEGER,
  "perCustomerLimit" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

CREATE TABLE "CouponRedemption" (
  "id" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "codeSnapshot" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "discountCents" INTEGER NOT NULL,
  "customerKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");
CREATE INDEX "CouponRedemption_couponId_customerKey_idx" ON "CouponRedemption"("couponId", "customerKey");

ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
