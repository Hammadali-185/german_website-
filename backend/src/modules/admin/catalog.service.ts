import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../utils/http.js";

export type PageQuery = { q?: string; page: number; pageSize: number };

export function cleanImageUrl(value: string | null | undefined) {
  if (value == null || value.trim() === "") return null;
  const trimmed = value.trim();
  if (trimmed.length > 500) throw new HttpError(400, "Die Bildadresse ist zu lang.", "IMAGE");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new HttpError(400, "Die Bildadresse ist ungültig.", "IMAGE");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HttpError(400, "Die Bildadresse muss mit http oder https beginnen.", "IMAGE");
  }
  return url.toString();
}

function skip(query: PageQuery) {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

export async function listProducts(query: PageQuery & { categoryId?: string; available?: boolean; isOffer?: boolean }) {
  const q = query.q?.trim();
  const where: Prisma.ProductWhereInput = {
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.available == null ? {} : { available: query.available }),
    ...(query.isOffer == null ? {} : { isOffer: query.isOffer }),
    ...(q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] }
      : {}),
  };
  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      ...skip(query),
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
      include: { category: { select: { id: true, name: true, slug: true } }, variants: { orderBy: { sortOrder: "asc" } } },
    }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function listCategories(query: PageQuery) {
  const q = query.q?.trim();
  const where: Prisma.CategoryWhereInput = q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] } : {};
  const [total, items] = await Promise.all([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      ...skip(query),
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function listVariants(query: PageQuery) {
  const q = query.q?.trim();
  const where: Prisma.ProductVariantWhereInput = q
    ? { OR: [{ label: { contains: q, mode: "insensitive" } }, { product: { name: { contains: q, mode: "insensitive" } } }, { product: { sku: { contains: q, mode: "insensitive" } } }] }
    : {};
  const [total, items] = await Promise.all([
    prisma.productVariant.count({ where }),
    prisma.productVariant.findMany({
      where,
      ...skip(query),
      orderBy: [{ product: { name: "asc" } }, { sortOrder: "asc" }],
      include: { product: { select: { id: true, name: true, sku: true } } },
    }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function updateVariant(id: string, input: { label?: string; detail?: string; priceCents?: number }) {
  const existing = await prisma.productVariant.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Variante nicht gefunden.", "NOT_FOUND");
  return prisma.productVariant.update({
    where: { id: existing.id },
    data: {
      ...(input.label == null ? {} : { label: input.label }),
      ...(input.detail == null ? {} : { detail: input.detail }),
      ...(input.priceCents == null ? {} : { priceCents: input.priceCents }),
    },
  });
}

export async function listExtras(query: PageQuery) {
  const q = query.q?.trim();
  const where: Prisma.ExtraWhereInput = q ? { name: { contains: q, mode: "insensitive" } } : {};
  const [total, items] = await Promise.all([
    prisma.extra.count({ where }),
    prisma.extra.findMany({
      where,
      ...skip(query),
      orderBy: { name: "asc" },
      include: { _count: { select: { prices: true } } },
    }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function renameExtra(id: string, name: string) {
  const existing = await prisma.extra.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Extra nicht gefunden.", "NOT_FOUND");
  return prisma.extra.update({ where: { id }, data: { name } });
}

export async function deleteCategory(id: string) {
  const category = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
  if (!category) throw new HttpError(404, "Kategorie nicht gefunden.", "NOT_FOUND");
  if (category._count.products > 0) throw new HttpError(409, "Die Kategorie enthält noch Produkte und kann nicht gelöscht werden.", "CATEGORY_IN_USE");
  await prisma.category.delete({ where: { id } });
  return { ok: true };
}
