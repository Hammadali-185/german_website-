import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../utils/http.js";

const detailInclude = {
  category: true,
  variants: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      choiceGroups: {
        orderBy: { sortOrder: "asc" as const },
        include: { options: { orderBy: { sortOrder: "asc" as const } } },
      },
      extraPrices: { include: { extra: true } },
    },
  },
} satisfies Prisma.ProductInclude;

const listInclude = {
  category: true,
  variants: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      _count: { select: { choiceGroups: true, extraPrices: true } },
    },
  },
} satisfies Prisma.ProductInclude;

type DetailProduct = Prisma.ProductGetPayload<{ include: typeof detailInclude }>;
type ListProduct = Prisma.ProductGetPayload<{ include: typeof listInclude }>;

function fromPrice(prices: number[]) {
  return prices.length ? Math.min(...prices) : 0;
}

export function toDetail(product: DetailProduct) {
  const variants = product.variants.map((variant) => ({
    id: variant.id,
    label: variant.label,
    detail: variant.detail,
    priceCents: variant.priceCents,
    includedExtraCount: variant.includedExtraCount,
    sourcePriceId: variant.sourcePriceId,
    choiceGroups: variant.choiceGroups.map((group) => ({
      id: group.id,
      name: group.name,
      required: group.required,
      selectionType: group.selectionType,
      options: group.options.map((option) => ({
        id: option.id,
        label: option.label,
        priceCents: option.priceCents,
      })),
    })),
    extras: variant.extraPrices
      .map((price) => ({
        id: price.extra.id,
        sourceExtraId: price.extra.sourceExtraId,
        name: price.extra.name,
        priceCents: price.priceCents,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
  }));
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    allergenCodes: product.allergenCodes,
    available: product.available,
    isOffer: product.isOffer,
    image: product.category.image,
    category: { id: product.category.id, slug: product.category.slug, name: product.category.name },
    fromPriceCents: fromPrice(variants.map((variant) => variant.priceCents)),
    variants,
  };
}

export function toListItem(product: ListProduct) {
  const variants = product.variants.map((variant) => ({
    id: variant.id,
    label: variant.label,
    detail: variant.detail,
    priceCents: variant.priceCents,
    includedExtraCount: variant.includedExtraCount,
    choiceGroupCount: variant._count.choiceGroups,
    extraCount: variant._count.extraPrices,
  }));
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    allergenCodes: product.allergenCodes,
    available: product.available,
    isOffer: product.isOffer,
    image: product.category.image,
    category: { id: product.category.id, slug: product.category.slug, name: product.category.name },
    fromPriceCents: fromPrice(variants.map((variant) => variant.priceCents)),
    customizable: variants.length > 1 || variants.some((variant) => variant.choiceGroupCount > 0 || variant.extraCount > 0),
    variants,
  };
}

export async function listCategories() {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  return categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    image: category.image,
    sortOrder: category.sortOrder,
    publishedCount: category.publishedCount,
  }));
}

export async function listProducts(filter: { category?: string; offers?: boolean; q?: string; full?: boolean }) {
  if (filter.full) {
    const products = await prisma.product.findMany({
      where: {
        category: filter.category ? { slug: filter.category } : undefined,
        isOffer: filter.offers ? true : undefined,
        OR: filter.q
          ? [
              { name: { contains: filter.q, mode: "insensitive" } },
              { description: { contains: filter.q, mode: "insensitive" } },
              { sku: { contains: filter.q, mode: "insensitive" } },
            ]
          : undefined,
      },
      include: detailInclude,
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    });
    return products.map((product) => {
      const detail = toDetail(product);
      return {
        ...detail,
        orderingEnabled: true,
        customizable:
          detail.variants.length > 1 ||
          detail.variants.some((variant) => variant.choiceGroups.length > 0 || variant.extras.length > 0),
      };
    });
  }
  const products = await prisma.product.findMany({
    where: {
      category: filter.category ? { slug: filter.category } : undefined,
      isOffer: filter.offers ? true : undefined,
      OR: filter.q
        ? [
            { name: { contains: filter.q, mode: "insensitive" } },
            { description: { contains: filter.q, mode: "insensitive" } },
            { sku: { contains: filter.q, mode: "insensitive" } },
          ]
        : undefined,
    },
    include: listInclude,
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });
  return products.map(toListItem);
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, include: detailInclude });
  if (!product) throw new HttpError(404, "Produkt nicht gefunden.", "NOT_FOUND");
  return toDetail(product);
}
