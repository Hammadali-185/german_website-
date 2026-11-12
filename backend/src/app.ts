import "./config/load-env.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { ensureCsrf, loadUser, requireCsrf } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { authRouter } from "./modules/authentication/auth.routes.js";
import { deliveryRouter } from "./modules/delivery/delivery.routes.js";
import { orderRouter } from "./modules/orders/orders.routes.js";
import { paymentRouter } from "./modules/payments/payments.routes.js";
import { productRouter } from "./modules/products/products.routes.js";
import { restaurantRouter } from "./modules/restaurant/restaurant.routes.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "750kb" }));
  app.use(cookieParser());
  app.use(ensureCsrf);
  app.use(requireCsrf);
  app.use(loadUser);
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api", productRouter);
  app.use("/api", restaurantRouter);
  app.use("/api", deliveryRouter);
  app.use("/api", authRouter);
  app.use("/api", orderRouter);
  app.use("/api", paymentRouter);
  app.use("/api/admin", adminRouter);
  app.use(errorHandler);
  return app;
}
