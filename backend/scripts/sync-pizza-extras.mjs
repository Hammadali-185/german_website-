import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  const text = readFileSync(path.join(backendRoot, ".env"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    if (process.env[key] === undefined) process.env[key] = match[2].trim();
  }
} catch {
  // DATABASE_URL may already be set by the shell.
}

const root = path.join(backendRoot, "..");
const products = JSON.parse(readFileSync(path.join(root, "data", "products.json"), "utf8"));
const targets = new Set(["11", "12", "13", "15", "16", "102a"]);
const prisma = new PrismaClient();

async function main() {
  const extras = await prisma.extra.findMany();
  const extraId = new Map(extras.map((extra) => [extra.sourceExtraId, extra.id]));
  let linked = 0;

  for (const product of products.filter((entry) => targets.has(entry.sku))) {
    if (product.sku !== "102a" && product.categorySlug !== "american-pizza") continue;
    const dbProduct = await prisma.product.findFirst({
      where: { sku: product.sku },
      include: { variants: { include: { extraPrices: true } } },
    });
    if (!dbProduct) {
      console.warn("skip missing product", product.sku);
      continue;
    }

    for (const sourceVariant of product.variants) {
      const variant = dbProduct.variants.find((entry) => entry.label === sourceVariant.label);
      if (!variant) {
        console.warn("skip missing variant", product.sku, sourceVariant.label);
        continue;
      }
      if (variant.extraPrices.length) continue;

      const rows = [];
      for (const extra of sourceVariant.extras) {
        const id = extraId.get(extra.sourceExtraId);
        if (!id) {
          console.warn("missing extra", extra.sourceExtraId, extra.name);
          continue;
        }
        rows.push({ variantId: variant.id, extraId: id, priceCents: extra.priceCents });
      }
      if (!rows.length) continue;
      await prisma.variantExtra.createMany({ data: rows });
      linked += rows.length;
      console.log("linked", product.sku, sourceVariant.label, rows.length);
    }
  }

  console.log("done", linked);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
