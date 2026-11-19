-- Nullable promise and cash-collection time. Existing orders and payments stay unchanged.
ALTER TABLE "Restaurant" ADD COLUMN "preparationMinutes" INTEGER;
ALTER TABLE "Restaurant" ADD COLUMN "deliveryMinutesPerKm" INTEGER;
ALTER TABLE "Order" ADD COLUMN "promisedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "paidAt" TIMESTAMP(3);
