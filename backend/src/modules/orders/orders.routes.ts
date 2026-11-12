import { Router } from "express";
import { prisma } from "../../database/prisma.js";
import { asyncRoute } from "../../utils/http.js";
import { requireUser } from "../../middleware/auth.js";
import { orderLimiter } from "../../middleware/rateLimit.js";
import { contactSchema, orderSchema, quoteSchema } from "./orders.schema.js";
import { createOrder, getOwnOrder, listOwnOrders, quoteOrder } from "./orders.service.js";

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
