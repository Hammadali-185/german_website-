import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { requireAdmin } from "../../middleware/auth.js";
import { asyncRoute, HttpError } from "../../utils/http.js";
import { listAdminNotifications, markAdminNotificationsRead } from "../orders/notifications.service.js";
import { collectCashPayment, presentOrder, updateOrderStatus } from "../orders/orders.service.js";
import { getAnalytics } from "./analytics.service.js";
import { couponRedemptions, deleteUnusedCoupon, listCoupons, normalizeCouponCode } from "./coupons.service.js";
import { getAdminOrder, listAdminOrders, listDeliveries, type DeliveryQueue } from "./order-query.js";
import { getReport, reportCsv } from "./reports.service.js";
import { systemStatus } from "./system.service.js";
import { cleanImageUrl, deleteCategory, listCategories, listExtras, listProducts, listVariants, renameExtra, updateVariant } from "./catalog.service.js";
import { customerOrders, listCustomers } from "./customers.service.js";

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
  image: z.string().trim().max(500).nullable().optional(),
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
      recent: recent.map((order) => presentOrder(order)),
    });
  }),
);

const analyticsQuery = z.object({
  preset: z.enum(["today", "7d", "30d", "month", "custom"]).default("today"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  granularity: z.enum(["day", "week", "month"]).default("day"),
});

adminRouter.get(
  "/reports",
  asyncRoute(async (req, res) => {
    res.json(await getReport(analyticsQuery.parse(req.query)));
  }),
);

adminRouter.get(
  "/reports.csv",
  asyncRoute(async (req, res) => {
    const file = await reportCsv(analyticsQuery.parse(req.query));
    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename="${file.filename}"`);
    res.setHeader("x-content-type-options", "nosniff");
    res.send(file.body);
  }),
);

adminRouter.get(
  "/system",
  asyncRoute(async (_req, res) => {
    res.json(systemStatus());
  }),
);

const couponBody = z.object({
  code: z.string().trim().min(3).max(32),
  type: z.enum(["PERCENT", "FIXED"]),
  percentOff: z.number().int().min(1).max(100).nullable().optional(),
  amountOffCents: z.number().int().positive().nullable().optional(),
  minimumSubtotalCents: z.number().int().nonnegative().default(0),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  active: z.boolean().default(true),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  perCustomerLimit: z.number().int().positive().nullable().optional(),
});

function couponData(body: z.infer<typeof couponBody>) {
  if (body.type === "PERCENT" && body.percentOff == null) throw new HttpError(400, "Der Prozentsatz fehlt.", "COUPON");
  if (body.type === "FIXED" && body.amountOffCents == null) throw new HttpError(400, "Der Festbetrag fehlt.", "COUPON");
  return {
    code: normalizeCouponCode(body.code),
    type: body.type,
    percentOff: body.type === "PERCENT" ? body.percentOff ?? null : null,
    amountOffCents: body.type === "FIXED" ? body.amountOffCents ?? null : null,
    minimumSubtotalCents: body.minimumSubtotalCents,
    startsAt: body.startsAt ? new Date(body.startsAt) : null,
    endsAt: body.endsAt ? new Date(body.endsAt) : null,
    active: body.active,
    maxRedemptions: body.maxRedemptions ?? null,
    perCustomerLimit: body.perCustomerLimit ?? null,
  };
}

adminRouter.get(
  "/coupons",
  asyncRoute(async (req, res) => {
    res.json(await listCoupons(pageQuery.parse(req.query)));
  }),
);

adminRouter.post(
  "/coupons",
  asyncRoute(async (req, res) => {
    const data = couponData(couponBody.parse(req.body));
    res.status(201).json(await prisma.coupon.create({ data }));
  }),
);

adminRouter.patch(
  "/coupons/:id",
  asyncRoute(async (req, res) => {
    const data = couponData(couponBody.parse(req.body));
    res.json(await prisma.coupon.update({ where: { id: req.params.id }, data }));
  }),
);

adminRouter.delete(
  "/coupons/:id",
  asyncRoute(async (req, res) => {
    res.json(await deleteUnusedCoupon(req.params.id));
  }),
);

adminRouter.get(
  "/coupons/:id/redemptions",
  asyncRoute(async (req, res) => {
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(20),
    }).parse(req.query);
    res.json(await couponRedemptions(req.params.id, query.page, query.pageSize));
  }),
);

adminRouter.get(
  "/analytics",
  asyncRoute(async (req, res) => {
    const query = analyticsQuery.parse(req.query);
    res.json(await getAnalytics(query));
  }),
);

const orderListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "PREPARING", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "COMPLETED", "CANCELLED"]).optional(),
  fulfillment: z.enum(["DELIVERY", "PICKUP"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

adminRouter.get(
  "/orders",
  asyncRoute(async (req, res) => {
    res.json(await listAdminOrders(orderListQuery.parse(req.query)));
  }),
);

adminRouter.get(
  "/orders/:id",
  asyncRoute(async (req, res) => {
    res.json(await getAdminOrder(req.params.id));
  }),
);

adminRouter.get(
  "/deliveries",
  asyncRoute(async (req, res) => {
    const query = orderListQuery.omit({ fulfillment: true, status: true }).extend({
      queue: z.enum(["all", "pending", "active", "completed", "rejected", "cancelled"]).default("all"),
    }).parse(req.query);
    res.json(await listDeliveries({ ...query, queue: query.queue as DeliveryQueue }));
  }),
);

adminRouter.patch(
  "/orders/:id",
  asyncRoute(async (req, res) => {
    const body = statusSchema.parse(req.body);
    res.json(await updateOrderStatus(req.params.id, body.status));
  }),
);

adminRouter.post(
  "/orders/:id/payment",
  asyncRoute(async (req, res) => {
    z.object({ collected: z.literal(true) }).parse(req.body);
    res.json(await collectCashPayment(req.params.id));
  }),
);

adminRouter.get(
  "/notifications",
  asyncRoute(async (_req, res) => {
    res.json(await listAdminNotifications());
  }),
);

adminRouter.post(
  "/notifications/read",
  asyncRoute(async (req, res) => {
    const body = z.object({ ids: z.array(z.string().min(1)).max(50).optional() }).parse(req.body ?? {});
    res.json(await markAdminNotificationsRead(body.ids));
  }),
);

const pageQuery = z.object({
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

adminRouter.get(
  "/products",
  asyncRoute(async (req, res) => {
    const query = pageQuery.extend({
      categoryId: z.string().min(1).optional(),
      available: z.enum(["true", "false"]).optional(),
      isOffer: z.enum(["true", "false"]).optional(),
    }).parse(req.query);
    res.json(await listProducts({
      ...query,
      available: query.available == null ? undefined : query.available === "true",
      isOffer: query.isOffer == null ? undefined : query.isOffer === "true",
    }));
  }),
);

adminRouter.get(
  "/categories",
  asyncRoute(async (req, res) => {
    res.json(await listCategories(pageQuery.parse(req.query)));
  }),
);

adminRouter.delete(
  "/categories/:id",
  asyncRoute(async (req, res) => {
    res.json(await deleteCategory(req.params.id));
  }),
);

adminRouter.get(
  "/variants",
  asyncRoute(async (req, res) => {
    res.json(await listVariants(pageQuery.parse(req.query)));
  }),
);

adminRouter.patch(
  "/variants/:id",
  asyncRoute(async (req, res) => {
    const body = z.object({
      label: z.string().trim().min(1).optional(),
      detail: z.string().optional(),
      priceCents: z.number().int().nonnegative().optional(),
    }).parse(req.body);
    res.json(await updateVariant(req.params.id, body));
  }),
);

adminRouter.get(
  "/customers",
  asyncRoute(async (req, res) => {
    const query = pageQuery.extend({ sort: z.enum(["latest", "oldest", "spending", "orders", "name"]).default("latest") }).parse(req.query);
    res.json(await listCustomers(query));
  }),
);

adminRouter.get(
  "/customers/:key/orders",
  asyncRoute(async (req, res) => {
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(20),
    }).parse(req.query);
    res.json(await customerOrders(req.params.key, query.page, query.pageSize));
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
        image: cleanImageUrl(body.image),
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
        ...(body.image === undefined ? {} : { image: cleanImageUrl(body.image) }),
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
  asyncRoute(async (req, res) => {
    res.json(await listExtras(pageQuery.parse(req.query)));
  }),
);

adminRouter.patch(
  "/extras/:id",
  asyncRoute(async (req, res) => {
    const body = z.object({ name: z.string().trim().min(1).max(120) }).parse(req.body);
    res.json(await renameExtra(req.params.id, body.name));
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
    const body = z.object({
      holidayMode: z.boolean(),
      pickupMinimumCents: z.number().int().nonnegative(),
      preparationMinutes: z.number().int().min(0).max(240).nullable().optional(),
      deliveryMinutesPerKm: z.number().int().min(0).max(120).nullable().optional(),
    }).parse(req.body);
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
