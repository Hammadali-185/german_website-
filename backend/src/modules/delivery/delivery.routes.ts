import { Router } from "express";
import { z } from "zod";
import { asyncRoute } from "../../utils/http.js";
import { checkDelivery, listDeliveryAreas } from "./delivery.service.js";

const checkSchema = z.object({
  postalCode: z.string().trim().regex(/^\d{5}$/, "Bitte eine fünfstellige Postleitzahl eingeben."),
  locality: z.string().trim().optional(),
  subtotalCents: z.number().int().nonnegative().optional(),
});

export const deliveryRouter = Router();

deliveryRouter.get(
  "/delivery/areas",
  asyncRoute(async (_req, res) => {
    const areas = await listDeliveryAreas();
    res.json(
      areas.map((area) => ({
        id: area.id,
        postalCode: area.postalCode,
        locality: area.locality,
        minimumOrderCents: area.minimumOrderCents,
        deliveryFeeCents: area.deliveryFeeCents,
      })),
    );
  }),
);

deliveryRouter.post(
  "/delivery/check",
  asyncRoute(async (req, res) => {
    res.json(await checkDelivery(checkSchema.parse(req.body)));
  }),
);
