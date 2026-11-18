import { readFile } from "node:fs/promises";
import path from "node:path";
import { distanceKm } from "@pizzablitz/shared";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../utils/http.js";

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    locality?: string;
    district?: string;
    county?: string;
    state?: string;
    country?: string;
  };
};

export type AddressSuggestion = {
  id: string;
  label: string;
  detail: string;
  street: string;
  postalCode: string;
  city: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
};

const SHOP_FALLBACK = { latitude: 49.2187392, longitude: 8.7126137 };

export async function shopPoint() {
  try {
    const restaurant = await prisma.restaurant.findFirst({ select: { latitude: true, longitude: true } });
    if (restaurant) return restaurant;
  } catch {
    // The published restaurant file keeps lookup working when the database is offline.
  }
  try {
    const file = JSON.parse(await readFile(path.join(env.DATA_DIR, "restaurant.json"), "utf8")) as {
      latitude?: number;
      longitude?: number;
    };
    if (typeof file.latitude === "number" && typeof file.longitude === "number") {
      return { latitude: file.latitude, longitude: file.longitude };
    }
  } catch {
    // Use the saved Östringen coordinates below.
  }
  return SHOP_FALLBACK;
}

export async function suggestAddresses(query: string) {
  const shop = await shopPoint();
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("lat", String(shop.latitude));
  url.searchParams.set("lon", String(shop.longitude));
  url.searchParams.set("location_bias_scale", "0.6");
  url.searchParams.set("limit", "6");
  url.searchParams.set("lang", "de");

  let payload: { features?: PhotonFeature[] };
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "PizzaBlitz/1.0 (delivery address lookup)",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(String(response.status));
    payload = (await response.json()) as { features?: PhotonFeature[] };
  } catch {
    throw new HttpError(502, "Adressvorschläge sind gerade nicht verfügbar.", "GEOCODE");
  }

  return (payload.features ?? [])
    .map((feature, index) => toSuggestion(feature, index, shop))
    .filter((suggestion): suggestion is AddressSuggestion => suggestion !== null);
}

function toSuggestion(feature: PhotonFeature, index: number, shop: { latitude: number; longitude: number }): AddressSuggestion | null {
  const [longitude, latitude] = feature.geometry?.coordinates ?? [];
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  const properties = feature.properties ?? {};
  const streetLine = [properties.street, properties.housenumber].filter(Boolean).join(" ");
  const placeName = properties.name?.trim() ?? "";
  const city = properties.city || properties.locality || properties.county || "";
  const label = streetLine || placeName || city;
  if (!label) return null;
  const detailParts = [
    placeName && placeName !== label ? placeName : "",
    properties.district && properties.district !== city ? properties.district : "",
    [properties.postcode, city].filter(Boolean).join(" "),
    properties.state ?? "",
  ].filter(Boolean);
  return {
    id: `${properties.osm_id ?? index}-${latitude.toFixed(5)}-${longitude.toFixed(5)}`,
    label,
    detail: detailParts.join(" · "),
    street: streetLine || placeName || label,
    postalCode: properties.postcode ?? "",
    city,
    latitude,
    longitude,
    distanceKm: Math.round(distanceKm(shop, { latitude, longitude }) * 10) / 10,
  };
}
