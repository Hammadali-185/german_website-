import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { asyncRoute } from "../../utils/http.js";
import { requireUser } from "../../middleware/auth.js";
import { orderLimiter } from "../../middleware/rateLimit.js";
import { contactSchema, orderSchema, quoteSchema } from "./orders.schema.js";
import { listCustomerNotifications, markCustomerNotificationsRead } from "./notifications.service.js";
import { createOrder, getOrderByTrackingToken, getOwnOrder, listOwnOrders, quoteOrder } from "./orders.service.js";

const readSchema = z.object({
  ids: z.array(z.string().min(1)).max(50).optional(),
});

export const orderRouter = Router();

orderRouter.post(
  "/orders/quote",
  orderLimiter,
  asyncRoute(async (req, res) => {
    res.json(await quoteOrder(quoteSchema.parse(req.body)));
  }),
);

orderRouter.post(
  "/orders",
  orderLimiter,
  asyncRoute(async (req, res) => {
    const order = await createOrder(orderSchema.parse(req.body), req.user?.id);
    res.status(201).json(order);
  }),
);

orderRouter.get(
  "/orders/my-orders",
  requireUser,
  asyncRoute(async (req, res) => {
    res.json(await listOwnOrders(req.user!.id));
  }),
);

orderRouter.get(
  "/orders/track/:token",
  orderLimiter,
  asyncRoute(async (req, res) => {
    res.json(await getOrderByTrackingToken(req.params.token));
  }),
);

orderRouter.get(
  "/notifications",
  asyncRoute(async (req, res) => {
    if (!req.user) {
      res.json({ unreadCount: 0, items: [] });
      return;
    }
    res.json(await listCustomerNotifications(req.user.id));
  }),
);

orderRouter.post(
  "/notifications/read",
  requireUser,
  asyncRoute(async (req, res) => {
    const body = readSchema.parse(req.body ?? {});
    res.json(await markCustomerNotificationsRead(req.user!.id, body.ids));
  }),
);

orderRouter.get(
  "/orders/:id",
  requireUser,
  asyncRoute(async (req, res) => {
    res.json(await getOwnOrder(req.user!.id, req.params.id));
  }),
);

orderRouter.post(
  "/contact",
  orderLimiter,
  asyncRoute(async (req, res) => {
    const body = contactSchema.parse(req.body);
    const message = await prisma.contactMessage.create({ data: body });
    res.status(201).json({ id: message.id, stored: true, emailed: false });
  }),
);
