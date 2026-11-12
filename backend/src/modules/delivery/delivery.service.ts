import { evaluateFulfillment, isRestaurantOpen, type OpeningHour } from "@pizzablitz/shared";
import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../utils/http.js";

export async function listDeliveryAreas() {
  return prisma.deliveryArea.findMany({
    where: { active: true },
    orderBy: [{ postalCode: "asc" }, { locality: "asc" }],
  });
}

export async function checkDelivery(input: { postalCode: string; locality?: string; subtotalCents?: number }) {
  const postalCode = input.postalCode.trim();
  const matches = await prisma.deliveryArea.findMany({
    where: {
      active: true,
      postalCode,
      locality: input.locality ? { equals: input.locality, mode: "insensitive" } : undefined,
    },
    orderBy: { locality: "asc" },
  });
  const restaurant = await prisma.restaurant.findFirst();
  if (!restaurant) throw new HttpError(503, "Restaurantdaten sind noch nicht geladen.", "NOT_READY");
  const area = input.locality ? matches[0] ?? null : matches.length === 1 ? matches[0] : null;
  const decision = evaluateFulfillment({
    fulfillment: "DELIVERY",
    subtotalCents: input.subtotalCents ?? area?.minimumOrderCents ?? 0,
    area,
    pickupMinimumCents: restaurant.pickupMinimumCents,
  });
  return {
    matches: matches.map((match) => ({
      id: match.id,
      postalCode: match.postalCode,
      locality: match.locality,
      minimumOrderCents: match.minimumOrderCents,
      deliveryFeeCents: match.deliveryFeeCents,
    })),
    needsLocality: !input.locality && matches.length > 1,
    decision,
  };
}

export async function assertOrderAllowed(input: {
  fulfillment: "DELIVERY" | "PICKUP";
  subtotalCents: number;
  deliveryAreaId?: string;
  postalCode?: string;
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
    return { decision, areaId: null as string | null };
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
  return { decision, areaId: area.id };
}
