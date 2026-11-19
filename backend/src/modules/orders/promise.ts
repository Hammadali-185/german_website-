export function promisedAtFor(input: {
  createdAt: Date;
  fulfillment: "DELIVERY" | "PICKUP";
  distanceKm: number | null;
  preparationMinutes: number | null;
  deliveryMinutesPerKm: number | null;
}) {
  if (input.preparationMinutes == null) return null;
  if (input.fulfillment === "PICKUP") {
    return new Date(input.createdAt.getTime() + input.preparationMinutes * 60_000);
  }
  if (input.deliveryMinutesPerKm == null || input.distanceKm == null) return null;
  const travelMinutes = Math.ceil(input.distanceKm * input.deliveryMinutesPerKm);
  return new Date(input.createdAt.getTime() + (input.preparationMinutes + travelMinutes) * 60_000);
}
