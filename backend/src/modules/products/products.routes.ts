import { Router } from "express";
import { z } from "zod";
import { asyncRoute } from "../../utils/http.js";
import { getProduct, listCategories, listProducts } from "./products.service.js";

const querySchema = z.object({
  category: z.string().optional(),
  offers: z.enum(["true", "false"]).optional(),
  full: z.enum(["true", "false"]).optional(),
  q: z.string().optional(),
});

export const productRouter = Router();

productRouter.get(
  "/categories",
  asyncRoute(async (_req, res) => {
    res.json(await listCategories());
  }),
);

productRouter.get(
  "/products",
  asyncRoute(async (req, res) => {
    const query = querySchema.parse(req.query);
    res.json(await listProducts({ category: query.category, offers: query.offers === "true", q: query.q, full: query.full === "true" }));
  }),
);

productRouter.get(
  "/products/:id",
  asyncRoute(async (req, res) => {
    res.json(await getProduct(req.params.id));
  }),
);

productRouter.get(
  "/offers",
  asyncRoute(async (_req, res) => {
    res.json(await listProducts({ offers: true }));
  }),
);
