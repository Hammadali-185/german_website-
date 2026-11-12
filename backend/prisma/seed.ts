import "../src/config/load-env.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/database/prisma.js";
import { env } from "../src/config/env.js";
import { hashPassword } from "../src/utils/password.js";

type ChoiceGroup = {
  sourceKey: string;
  name: string;
  required: boolean;
  selectionType: string;
  sortOrder: number;
  options: { label: string; priceCents: number; sortOrder: number }[];
};

type Variant = {
  label: string;
  detail: string;
  priceCents: number;
  sourceProductId: string | null;
  sourcePriceId: string | null;
  sortOrder: number;
  includedExtraCount: number;
  choiceGroups: ChoiceGroup[];
  extras: { sourceExtraId: string; name: string; priceCents: number }[];
};

type SourceProduct = {
  sku: string;
  name: string;
  description: string;
  allergenCodes: string;
  categorySlug: string;
  isOffer: boolean;
  variants: Variant[];
};

type SourceCategory = {
  slug: string;
  name: string;
  image: string | null;
  sortOrder: number;
  publishedCount: number;
};

async function readJson<T>(name: string): Promise<T> {
  const file = path.resolve(process.cwd(), env.DATA_DIR, name);
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main() {
  const [restaurant, categories, products, areas, hours] = await Promise.all([
    readJson<Record<string, unknown>>("restaurant.json"),
    readJson<SourceCategory[]>("categories.json"),
    readJson<SourceProduct[]>("products.json"),
    readJson<{ postalCode: string; locality: string; externalId: string; minimumOrderCents: number; deliveryFeeCents: number | null }[]>("delivery-areas.json"),
    readJson<{ day: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY" | "HOLIDAY"; label: string; opens: string; closes: string }[]>("opening-hours.json"),
  ]);

  if (products.length !== 236) {
    throw new Error(`Expected 236 products, found ${products.length}`);
  }
  if (categories.length !== 22) {
    throw new Error(`Expected 22 categories, found ${categories.length}`);
  }

  await prisma.contactMessage.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.session.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();
  await prisma.variantExtra.deleteMany();
  await prisma.choiceOption.deleteMany();
  await prisma.choiceGroup.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.extra.deleteMany();
  await prisma.category.deleteMany();
  await prisma.deliveryArea.deleteMany();
  await prisma.openingHours.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.restaurant.deleteMany();

  const announcement = restaurant.announcement as {
    title: string;
    body: string;
    active: boolean;
    phoneOnly: boolean;
    minimumOrderCents: number;
  };

  const createdRestaurant = await prisma.restaurant.create({
    data: {
      legalName: String(restaurant.legalName),
      tradeName: String(restaurant.tradeName),
      publicName: String(restaurant.publicName),
      ownerName: String(restaurant.ownerName),
      street: String(restaurant.street),
      postalCode: String(restaurant.postalCode),
      city: String(restaurant.city),
      country: String(restaurant.country),
      phone: String(restaurant.phone),
      phoneInternational: String(restaurant.phoneInternational),
      fax: String(restaurant.fax),
      faxInternational: String(restaurant.faxInternational),
      email: null,
      website: String(restaurant.website),
      facebookUrl: restaurant.facebookUrl ? String(restaurant.facebookUrl) : null,
      latitude: Number(restaurant.latitude),
      longitude: Number(restaurant.longitude),
      logo: String(restaurant.logo),
      yearsClaim: String(restaurant.yearsClaim),
      timezone: String(restaurant.timezone),
      pickupMinimumCents: Number(restaurant.pickupMinimumCents ?? 0),
      holidayMode: false,
      hours: { create: hours },
    },
  });

  await prisma.promotion.create({
    data: {
      slug: "phone-gift",
      title: announcement.title,
      body: announcement.body,
      active: announcement.active,
      phoneOnly: announcement.phoneOnly,
      minimumOrderCents: announcement.minimumOrderCents,
    },
  });

  await prisma.deliveryArea.createMany({ data: areas });
  await prisma.category.createMany({ data: categories });
  const categoryRows = await prisma.category.findMany();
  const categoryId = new Map(categoryRows.map((category) => [category.slug, category.id]));

  const extraNames = new Map<string, string>();
  for (const product of products) {
    for (const variant of product.variants) {
      for (const extra of variant.extras) {
        if (!extraNames.has(extra.sourceExtraId)) extraNames.set(extra.sourceExtraId, extra.name.trim());
      }
    }
  }
  await prisma.extra.createMany({
    data: [...extraNames.entries()].map(([sourceExtraId, name]) => ({ sourceExtraId, name })),
  });
  const extraRows = await prisma.extra.findMany();
  const extraId = new Map(extraRows.map((extra) => [extra.sourceExtraId, extra.id]));

  const variantExtras: { variantId: string; extraId: string; priceCents: number }[] = [];
  let sort = 0;
  for (const product of products) {
    const category = categoryId.get(product.categorySlug);
    if (!category) throw new Error(`Missing category ${product.categorySlug}`);
    if (!product.variants.length) throw new Error(`Product ${product.sku} has no variants`);
    const prepared = product.variants.map((variant, index) => {
      const base = variant.sourcePriceId || `missing-${index}`;
      return { ...variant, sourcePriceId: base };
    });
    const seen = new Set<string>();
    for (const variant of prepared) {
      let priceId = variant.sourcePriceId;
      while (seen.has(priceId)) priceId = `${priceId}-${seen.size}`;
      seen.add(priceId);
      variant.sourcePriceId = priceId;
    }
    const created = await prisma.product.create({
      data: {
        sku: product.sku,
        name: product.name,
        description: product.description,
        allergenCodes: product.allergenCodes ?? "",
        available: true,
        isOffer: product.isOffer,
        sortOrder: sort,
        sourceProductId: prepared.find((variant) => variant.sourceProductId)?.sourceProductId ?? null,
        categoryId: category,
        variants: {
          create: prepared.map((variant, index) => ({
            sourcePriceId: variant.sourcePriceId,
            label: variant.label,
            detail: variant.detail || variant.label,
            priceCents: variant.priceCents,
            includedExtraCount: variant.includedExtraCount ?? 0,
            sortOrder: variant.sortOrder ?? index,
          })),
        },
      },
      include: { variants: true },
    });
    sort += 1;

    for (const sourceVariant of prepared) {
      const saved = created.variants.find((variant) => variant.sourcePriceId === sourceVariant.sourcePriceId);
      if (!saved) throw new Error(`Variant missing for ${product.sku} ${sourceVariant.label}`);
      for (const extra of sourceVariant.extras) {
        const id = extraId.get(extra.sourceExtraId);
        if (!id) continue;
        variantExtras.push({ variantId: saved.id, extraId: id, priceCents: extra.priceCents });
      }
      for (const group of sourceVariant.choiceGroups) {
        await prisma.choiceGroup.create({
          data: {
            variantId: saved.id,
            sourceKey: group.sourceKey,
            name: group.name,
            required: group.required,
            selectionType: group.selectionType,
            sortOrder: group.sortOrder,
            options: { create: group.options },
          },
        });
      }
    }
  }

  for (let index = 0; index < variantExtras.length; index += 2000) {
    await prisma.variantExtra.createMany({ data: variantExtras.slice(index, index + 2000), skipDuplicates: true });
  }

  await prisma.user.create({
    data: {
      email: env.ADMIN_EMAIL.toLowerCase(),
      passwordHash: await hashPassword(env.ADMIN_PASSWORD),
      firstName: "Restaurant",
      lastName: "Admin",
      role: "ADMIN",
    },
  });

  const counts = {
    restaurant: createdRestaurant.publicName,
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    variants: await prisma.productVariant.count(),
    extras: await prisma.variantExtra.count(),
    areas: await prisma.deliveryArea.count(),
  };
  console.log(counts);
  if (counts.products !== 236 || counts.categories !== 22 || counts.areas !== 51) {
    throw new Error("Seed counts do not match the extraction.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
