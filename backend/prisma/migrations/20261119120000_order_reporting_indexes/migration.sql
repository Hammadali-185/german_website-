-- Additive indexes for admin reporting. Existing orders are unchanged.
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX "Order_fulfillment_createdAt_idx" ON "Order"("fulfillment", "createdAt");
