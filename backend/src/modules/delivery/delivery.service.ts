import { distanceKm, evaluateFulfillment, isRestaurantOpen, matchDeliveryAreas, OUTSIDE_DELIVERY_RADIUS_MESSAGE, pickDeliveryArea, withinDeliveryRadius, type OpeningHour } from "@pizzablitz/shared";
import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../utils/http.js";

export async function listDeliveryAreas() {
  return prisma.deliveryArea.findMany({
    where: { active: true },
    orderBy: [{ postalCode: "asc" }, { locality: "asc" }],
  });
}

export async function checkDelivery(input: {
  postalCode: string;
  city?: string;
  locality?: string;
  district?: string;
  subtotalCents?: number;
}) {
  const postalCode = input.postalCode.trim();
  const byPostal = await prisma.deliveryArea.findMany({
    where: { active: true, postalCode },
    orderBy: { locality: "asc" },
  });
  const restaurant = await prisma.restaurant.findFirst();
  if (!restaurant) throw new HttpError(503, "Restaurantdaten sind noch nicht geladen.", "NOT_READY");

  const place = {
    postalCode,
    city: input.city || input.locality,
    district: input.district,
    locality: input.locality,
  };
  const matched = matchDeliveryAreas(byPostal, place);
  const area = pickDeliveryArea(byPostal, place);
  const decision = evaluateFulfillment({
    fulfillment: "DELIVERY",
    subtotalCents: input.subtotalCents ?? area?.minimumOrderCents ?? 0,
    area,
    pickupMinimumCents: restaurant.pickupMinimumCents,
  });
  // Confident matches first; otherwise offer every area for this PLZ so the guest can choose.
  const pool = matched.length ? matched : byPostal;
  const matches = pool.map((match) => ({
    id: match.id,
    postalCode: match.postalCode,
    locality: match.locality,
    minimumOrderCents: match.minimumOrderCents,
    deliveryFeeCents: match.deliveryFeeCents,
  }));
  return {
    matches,
    needsLocality: !area && matches.length > 1,
    decision,
  };
}

export async function assertOrderAllowed(input: {
  fulfillment: "DELIVERY" | "PICKUP";
  subtotalCents: number;
  deliveryAreaId?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
}) {
  const restaurant = await prisma.restaurant.findFirst({ include: { hours: true } });
  if (!restaurant) throw new HttpError(503, "Restaurantdaten sind noch nicht geladen.", "NOT_READY");
  const hours: OpeningHour[] = restaurant.hours.map((hour) => ({
    day: hour.day,
    opens: hour.opens,
    closes: hour.closes,
  }));
  if (!isRestaurantOpen(new Date(), hours, restaurant.holidayMode)) {
    throw new HttpError(409, "Das Restaurant hat derzeit geschlossen. Eine Bestellung ist außerhalb der veröffentlichten Zeiten nicht möglich.", "CLOSED");
  }

  if (input.fulfillment === "PICKUP") {
    const decision = evaluateFulfillment({
      fulfillment: "PICKUP",
      subtotalCents: input.subtotalCents,
      area: null,
      pickupMinimumCents: restaurant.pickupMinimumCents,
    });
    if (!decision.ok) throw new HttpError(400, decision.message, decision.code);
    return { decision, areaId: null as string | null, distanceKm: null as number | null };
  }

  if (typeof input.latitude !== "number" || typeof input.longitude !== "number") {
    throw new HttpError(400, "Bitte eine Adresse aus den Vorschlägen auswählen.", "ADDRESS");
  }
  const destination = { latitude: input.latitude, longitude: input.longitude };
  const shop = { latitude: restaurant.latitude, longitude: restaurant.longitude };
  const kilometers = Math.round(distanceKm(shop, destination) * 10) / 10;
  if (!withinDeliveryRadius(shop, destination)) {
    throw new HttpError(400, OUTSIDE_DELIVERY_RADIUS_MESSAGE, "RADIUS");
  }

  if (!input.deliveryAreaId) throw new HttpError(400, "Bitte ein Liefergebiet wählen.", "AREA");
  const area = await prisma.deliveryArea.findFirst({ where: { id: input.deliveryAreaId, active: true } });
  if (!area || (input.postalCode && area.postalCode !== input.postalCode.trim())) {
    throw new HttpError(400, "Diese Adresse liegt außerhalb der veröffentlichten Liefergebiete.", "AREA");
  }
  const decision = evaluateFulfillment({
    fulfillment: "DELIVERY",
    subtotalCents: input.subtotalCents,
    area,
    pickupMinimumCents: restaurant.pickupMinimumCents,
  });
  if (!decision.ok) throw new HttpError(400, decision.message, decision.code);
  return { decision, areaId: area.id, distanceKm: kilometers };
}
