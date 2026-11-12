import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { requireAdmin } from "../../middleware/auth.js";
import { asyncRoute, HttpError } from "../../utils/http.js";

const statusSchema = z.object({
  status: z.enum([
    "PENDING",
    "ACCEPTED",
    "REJECTED",
    "PREPARING",
    "OUT_FOR_DELIVERY",
    "READY_FOR_PICKUP",
    "COMPLETED",
    "CANCELLED",
  ]),
});

const productSchema = z.object({
  categoryId: z.string().min(1),
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().default(""),
  allergenCodes: z.string().default(""),
  available: z.boolean().default(true),
  isOffer: z.boolean().default(false),
  variants: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().trim().min(1),
        detail: z.string().default(""),
        priceCents: z.number().int().nonnegative(),
        includedExtraCount: z.number().int().nonnegative().default(0),
      }),
    )
    .min(1),
});

function berlinDayStart(now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const guess = new Date(`${date}T00:00:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Berlin",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(guess)
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return new Date(guess.getTime() - (asUtc - guess.getTime()));
}

export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get(
  "/stats",
  asyncRoute(async (_req, res) => {
    const start = berlinDayStart();
    const [totalOrders, pendingOrders, completedOrders, todayOrders, recent] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.count({ where: { status: "COMPLETED" } }),
      prisma.order.findMany({
        where: { createdAt: { gte: start }, status: { notIn: ["REJECTED", "CANCELLED"] } },
        select: { totalCents: true },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { payment: true },
      }),
    ]);
    res.json({
      totalOrders,
      pendingOrders,
      completedOrders,
      dailySalesCents: todayOrders.reduce((sum, order) => sum + order.totalCents, 0),
      recent,
    });
  }),
);

adminRouter.get(
  "/orders",
  asyncRoute(async (_req, res) => {
    res.json(
      await prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { items: true, payment: true, deliveryArea: true },
      }),
    );
  }),
);

adminRouter.patch(
  "/orders/:id",
  asyncRoute(async (req, res) => {
    const body = statusSchema.parse(req.body);
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, "Bestellung nicht gefunden.", "NOT_FOUND");
    res.json(await prisma.order.update({ where: { id: existing.id }, data: { status: body.status }, include: { payment: true } }));
  }),
);

adminRouter.get(
  "/products",
  asyncRoute(async (_req, res) => {
    res.json(
      await prisma.product.findMany({
        orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
        include: {
          category: true,
          variants: { orderBy: { sortOrder: "asc" }, include: { extraPrices: { include: { extra: true } } } },
        },
      }),
    );
  }),
);

adminRouter.post(
  "/products",
  asyncRoute(async (req, res) => {
    const body = productSchema.parse(req.body);
    const product = await prisma.product.create({
      data: {
        categoryId: body.categoryId,
        sku: body.sku,
        name: body.name,
        description: body.description,
        allergenCodes: body.allergenCodes,
        available: body.available,
        isOffer: body.isOffer,
        variants: {
          create: body.variants.map((variant, index) => ({
            sourcePriceId: `manual-${index + 1}`,
            label: variant.label,
            detail: variant.detail,
            priceCents: variant.priceCents,
            includedExtraCount: variant.includedExtraCount,
            sortOrder: index,
          })),
        },
      },
      include: { variants: true },
    });
    res.status(201).json(product);
  }),
);

adminRouter.patch(
  "/products/:id",
  asyncRoute(async (req, res) => {
    const body = productSchema.parse(req.body);
    const existing = await prisma.product.findUnique({ where: { id: req.params.id }, include: { variants: true } });
    if (!existing) throw new HttpError(404, "Produkt nicht gefunden.", "NOT_FOUND");
    const product = await prisma.product.update({
      where: { id: existing.id },
      data: {
        categoryId: body.categoryId,
        sku: body.sku,
        name: body.name,
        description: body.description,
        allergenCodes: body.allergenCodes,
        available: body.available,
        isOffer: body.isOffer,
      },
    });
    for (const [index, variant] of body.variants.entries()) {
      if (variant.id) {
        await prisma.productVariant.update({
          where: { id: variant.id },
          data: {
            label: variant.label,
            detail: variant.detail,
            priceCents: variant.priceCents,
            includedExtraCount: variant.includedExtraCount,
            sortOrder: index,
          },
        });
      } else {
        await prisma.productVariant.create({
          data: {
            productId: product.id,
            sourcePriceId: `manual-${Date.now()}-${index}`,
            label: variant.label,
            detail: variant.detail,
            priceCents: variant.priceCents,
            includedExtraCount: variant.includedExtraCount,
            sortOrder: index,
          },
        });
      }
    }
    res.json(await prisma.product.findUnique({ where: { id: product.id }, include: { variants: true, category: true } }));
  }),
);

adminRouter.delete(
  "/products/:id",
  asyncRoute(async (req, res) => {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, "Produkt nicht gefunden.", "NOT_FOUND");
    await prisma.product.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);

adminRouter.patch(
  "/variants/:id/extras",
  asyncRoute(async (req, res) => {
    const body = z.object({ extras: z.array(z.object({ extraId: z.string(), priceCents: z.number().int().nonnegative() })) }).parse(req.body);
    const variant = await prisma.productVariant.findUnique({ where: { id: req.params.id } });
    if (!variant) throw new HttpError(404, "Variante nicht gefunden.", "NOT_FOUND");
    await prisma.variantExtra.deleteMany({ where: { variantId: variant.id } });
    if (body.extras.length) {
      await prisma.variantExtra.createMany({
        data: body.extras.map((extra) => ({ variantId: variant.id, extraId: extra.extraId, priceCents: extra.priceCents })),
      });
    }
    res.json({ ok: true });
  }),
);

adminRouter.get(
  "/extras",
  asyncRoute(async (_req, res) => {
    res.json(await prisma.extra.findMany({ orderBy: { name: "asc" } }));
  }),
);

adminRouter.post(
  "/extras",
  asyncRoute(async (req, res) => {
    const body = z.object({ name: z.string().trim().min(1), sourceExtraId: z.string().trim().min(1) }).parse(req.body);
    res.status(201).json(await prisma.extra.create({ data: body }));
  }),
);

adminRouter.post(
  "/categories",
  asyncRoute(async (req, res) => {
    const body = z.object({ name: z.string().trim().min(1), slug: z.string().trim().min(1) }).parse(req.body);
    const count = await prisma.category.count();
    res.status(201).json(await prisma.category.create({ data: { ...body, sortOrder: count } }));
  }),
);

adminRouter.patch(
  "/categories/:id",
  asyncRoute(async (req, res) => {
    const body = z.object({ name: z.string().trim().min(1) }).parse(req.body);
    res.json(await prisma.category.update({ where: { id: req.params.id }, data: body }));
  }),
);

adminRouter.patch(
  "/areas/:id",
  asyncRoute(async (req, res) => {
    const body = z
      .object({
        minimumOrderCents: z.number().int().nonnegative(),
        deliveryFeeCents: z.number().int().nonnegative().nullable(),
        active: z.boolean(),
      })
      .parse(req.body);
    res.json(await prisma.deliveryArea.update({ where: { id: req.params.id }, data: body }));
  }),
);

adminRouter.patch(
  "/hours/:id",
  asyncRoute(async (req, res) => {
    const body = z.object({ opens: z.string().regex(/^\d{2}:\d{2}$/), closes: z.string().regex(/^\d{2}:\d{2}$/) }).parse(req.body);
    res.json(await prisma.openingHours.update({ where: { id: req.params.id }, data: body }));
  }),
);

adminRouter.patch(
  "/restaurant",
  asyncRoute(async (req, res) => {
    const body = z.object({ holidayMode: z.boolean(), pickupMinimumCents: z.number().int().nonnegative() }).parse(req.body);
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) throw new HttpError(503, "Restaurantdaten fehlen.", "NOT_READY");
    res.json(await prisma.restaurant.update({ where: { id: restaurant.id }, data: body }));
  }),
);

adminRouter.patch(
  "/promotions/:slug",
  asyncRoute(async (req, res) => {
    const body = z
      .object({
        title: z.string().trim().min(1),
        body: z.string().trim().min(1),
        active: z.boolean(),
        phoneOnly: z.boolean(),
        minimumOrderCents: z.number().int().nonnegative().nullable(),
      })
      .parse(req.body);
    res.json(await prisma.promotion.update({ where: { slug: req.params.slug }, data: body }));
  }),
);

adminRouter.get(
  "/messages",
  asyncRoute(async (_req, res) => {
    res.json(await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 100 }));
  }),
);
