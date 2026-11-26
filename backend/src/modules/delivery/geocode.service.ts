import { readFile } from "node:fs/promises";
import path from "node:path";
import { DELIVERY_RADIUS_KM, distanceKm } from "@pizzablitz/shared";
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
    countrycode?: string;
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

const SHOP_FALLBACK = { latitude: 49.2187392, longitude: 8.7126137, city: "Östringen" };
/** Only return suggestions that are within the published delivery radius. */
export const SUGGESTION_RADIUS_KM = DELIVERY_RADIUS_KM;
const QUERY_STOP_WORDS = new Set(["gmbh", "haftungsbeschränkt", "straße", "strasse", "platz", "weg", "allee", "co", "kg", "und", "oder"]);

export async function shopPoint() {
  try {
    const restaurant = await prisma.restaurant.findFirst({ select: { latitude: true, longitude: true, city: true } });
    if (restaurant) return restaurant;
  } catch {
    // The published restaurant file keeps lookup working when the database is offline.
  }
  try {
    const file = JSON.parse(await readFile(path.join(env.DATA_DIR, "restaurant.json"), "utf8")) as {
      latitude?: number;
      longitude?: number;
      city?: string;
    };
    if (typeof file.latitude === "number" && typeof file.longitude === "number") {
      return { latitude: file.latitude, longitude: file.longitude, city: file.city ?? SHOP_FALLBACK.city };
    }
  } catch {
    // Use the saved Östringen coordinates below.
  }
  return SHOP_FALLBACK;
}

export async function suggestAddresses(query: string) {
  const shop = await shopPoint();
  const cleaned = query.trim();
  const city = shop.city?.trim();
  const lookups = [lookupSuggestions(cleaned, shop)];
  if (city && !cleaned.toLowerCase().includes(city.toLowerCase())) {
    lookups.push(lookupSuggestions(`${cleaned} ${city}`, shop));
  }
  const merged = rankSuggestions((await Promise.all(lookups)).flat());
  return filterSuggestions(cleaned, merged).slice(0, 6);
}

export function filterSuggestions(query: string, suggestions: AddressSuggestion[]) {
  const nearby = suggestions.filter((entry) => entry.distanceKm <= SUGGESTION_RADIUS_KM);
  const token = distinctiveQueryToken(query);
  if (!token) return nearby;
  const matched = nearby.filter((entry) => `${entry.label} ${entry.detail} ${entry.street}`.toLowerCase().includes(token));
  return matched.length ? matched : [];
}

export function distinctiveQueryToken(query: string) {
  const tokens = query
    .toLowerCase()
    .normalize("NFC")
    .split(/[^a-zäöüß0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 6 && !QUERY_STOP_WORDS.has(token));
  return tokens.sort((left, right) => right.length - left.length)[0] ?? null;
}

async function lookupSuggestions(query: string, shop: { latitude: number; longitude: number }) {
  const features = await fetchPhoton(query, shop);
  return rankSuggestions(
    features
      .map((feature, index) => toSuggestion(feature, index, shop))
      .filter((suggestion): suggestion is AddressSuggestion => suggestion !== null),
  );
}

async function fetchPhoton(query: string, shop: { latitude: number; longitude: number }) {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("lat", String(shop.latitude));
  url.searchParams.set("lon", String(shop.longitude));
  url.searchParams.set("location_bias_scale", "0.1");
  url.searchParams.set("limit", "12");
  url.searchParams.set("lang", "de");

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "PizzaBlitz/1.0 (delivery address lookup)",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(String(response.status));
    const payload = (await response.json()) as { features?: PhotonFeature[] };
    return payload.features ?? [];
  } catch {
    throw new HttpError(502, "Adressvorschläge sind gerade nicht verfügbar.", "GEOCODE");
  }
}

export function rankSuggestions(suggestions: AddressSuggestion[]) {
  const seen = new Set<string>();
  return [...suggestions]
    .sort((left, right) => left.distanceKm - right.distanceKm || left.label.localeCompare(right.label, "de"))
    .filter((suggestion) => {
      const key = `${suggestion.latitude.toFixed(5)}:${suggestion.longitude.toFixed(5)}:${suggestion.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function toSuggestion(feature: PhotonFeature, index: number, shop: { latitude: number; longitude: number }): AddressSuggestion | null {
  const [longitude, latitude] = feature.geometry?.coordinates ?? [];
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const properties = feature.properties ?? {};
  if (properties.countrycode && properties.countrycode.toUpperCase() !== "DE") return null;

  const streetLine = [properties.street, properties.housenumber].filter(Boolean).join(" ").trim();
  const placeName = properties.name?.trim() ?? "";
  const city = (properties.city || properties.locality || properties.district || properties.county || "").trim();
  const postalCode = (properties.postcode ?? "").trim();
  const label = placeName || streetLine || city;
  if (!label) return null;

  const detailParts = [
    placeName && streetLine ? streetLine : "",
    !placeName && streetLine && streetLine !== label ? streetLine : "",
    properties.district && properties.district !== city ? properties.district : "",
    [postalCode, city].filter(Boolean).join(" "),
    properties.state && properties.state !== city ? properties.state : "",
  ].filter(Boolean);

  return {
    id: `${properties.osm_id ?? index}-${latitude.toFixed(5)}-${longitude.toFixed(5)}`,
    label,
    detail: detailParts.join(" · "),
    street: streetLine || placeName || label,
    postalCode,
    city,
    latitude,
    longitude,
    distanceKm: Math.round(distanceKm(shop, { latitude, longitude }) * 10) / 10,
  };
}
