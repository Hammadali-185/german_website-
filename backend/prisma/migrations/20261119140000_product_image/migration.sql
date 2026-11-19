-- Additive nullable image address. Existing products, variants, and orders stay unchanged.
ALTER TABLE "Product" ADD COLUMN "image" TEXT;
