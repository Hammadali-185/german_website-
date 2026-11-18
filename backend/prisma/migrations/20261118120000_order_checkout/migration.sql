ALTER TABLE "Order" ALTER COLUMN "customerEmail" DROP NOT NULL;
ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
