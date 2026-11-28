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
  // DATABASE_URL may already be set.
}

const prisma = new PrismaClient();
const skus = ["220", "221", "223", "224", "225", "226", "227", "228"];

async function main() {
  const result = await prisma.productVariant.updateMany({
    where: { product: { sku: { in: skus } }, includedExtraCount: { not: 3 } },
    data: { includedExtraCount: 3 },
  });
  console.log("db variants updated", result.count);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
