import { Router } from "express";
import { asyncRoute } from "../../utils/http.js";
import { getLegal, getRestaurant } from "./restaurant.service.js";

export const restaurantRouter = Router();

restaurantRouter.get(
  "/restaurant",
  asyncRoute(async (_req, res) => {
    res.json(await getRestaurant());
  }),
);

restaurantRouter.get(
  "/restaurant/hours",
  asyncRoute(async (_req, res) => {
    const restaurant = await getRestaurant();
    res.json({ timezone: restaurant.timezone, holidayMode: restaurant.holidayMode, hours: restaurant.hours });
  }),
);

restaurantRouter.get(
  "/legal/:page",
  asyncRoute(async (req, res) => {
    const page = req.params.page;
    if (page !== "impressum" && page !== "agb" && page !== "datenschutz" && page !== "allergene") {
      res.status(404).json({ error: "Seite nicht gefunden." });
      return;
    }
    res.json(await getLegal(page));
  }),
);
