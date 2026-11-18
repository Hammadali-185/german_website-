export const DELIVERY_RADIUS_KM = 20;

export const OUTSIDE_DELIVERY_RADIUS_MESSAGE = "Sorry, we currently deliver only within 20 km of our shop.";

export type GeoPoint = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371.0088;

export function distanceKm(from: GeoPoint, to: GeoPoint) {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function withinDeliveryRadius(shop: GeoPoint, destination: GeoPoint) {
  return distanceKm(shop, destination) <= DELIVERY_RADIUS_KM;
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}
