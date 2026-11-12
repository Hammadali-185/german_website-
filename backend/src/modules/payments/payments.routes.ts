import { Router } from "express";
import { asyncRoute } from "../../utils/http.js";
import { paymentMethods } from "./payments.service.js";

export const paymentRouter = Router();

paymentRouter.get(
  "/payments/methods",
  asyncRoute(async (_req, res) => {
    res.json(paymentMethods());
  }),
);
