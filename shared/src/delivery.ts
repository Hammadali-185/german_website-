export type DeliveryAreaRule = {
  id?: string;
  postalCode: string;
  locality: string;
  minimumOrderCents: number;
  deliveryFeeCents: number | null;
};

export type DeliveryDecision =
  | {
      ok: true;
      deliveryFeeCents: number;
      minimumOrderCents: number;
      area: DeliveryAreaRule | null;
    }
  | {
      ok: false;
      code: "AREA" | "MINIMUM";
      message: string;
      minimumOrderCents?: number;
      deliveryFeeCents?: number;
      area?: DeliveryAreaRule | null;
    };

/** Generic labels shops use for the main town zone (not a specific Ortsteil). */
const CENTER_ALIASES = new Set(["zentrum", "city", "mitte", "kern", "kernstadt", "ortszentrum"]);

export type PlaceHints = {
  postalCode: string;
  /** Municipality / city from geocoding (e.g. Östringen, Sankt Leon-Rot). */
  city?: string;
  /** Ortsteil / district when distinct from the city (e.g. Odenheim, Rettigheim). */
  district?: string;
  /** Extra OSM locality string when present. */
  locality?: string;
};

export function normalizeLocality(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFC")
    .replace(/[.']/g, "")
    .replace(/[-–—_/]+/g, " ")
    .replace(/\s+/g, " ");
}

export function localityTokens(value: string) {
  return normalizeLocality(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function tokensMatch(left: string, right: string) {
  if (!left || !right) return false;
  if (left === right) return true;
  // Abbreviation support: "schön" / "schönborn", "bad schön" fragments.
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  return shorter.length >= 3 && longer.startsWith(shorter);
}

function sequenceMatches(query: string[], target: string[]) {
  if (!query.length || query.length > target.length) return false;
  return query.every((token, index) => tokensMatch(token, target[index]!));
}

function lastTokenIs(target: string[], candidate: string) {
  const last = target[target.length - 1];
  return Boolean(last && tokensMatch(last, candidate));
}

function isCenterAlias(token: string) {
  return CENTER_ALIASES.has(token);
}

function distinctHint(value: string | undefined, other: string) {
  const normalized = normalizeLocality(value ?? "");
  if (!normalized || normalized === other) return "";
  return normalized;
}

/**
 * Score how well a published Liefergebiet matches geocoded place hints.
 * Higher is better. Used for every postal area, not one town.
 */
export function scoreDeliveryArea(areaLocality: string, hints: Omit<PlaceHints, "postalCode">) {
  const areaNorm = normalizeLocality(areaLocality);
  const areaTokens = localityTokens(areaLocality);
  if (!areaNorm || !areaTokens.length) return 0;

  const city = normalizeLocality(hints.city ?? "");
  const district = distinctHint(hints.district, city);
  const locality = distinctHint(hints.locality, city);
  const cityTokens = localityTokens(city);
  const districtTokens = localityTokens(district);
  const localityTokensList = localityTokens(locality);

  let score = 0;
  const hasOrtsteilHint = Boolean(district || locality);

  const exactCandidates = [locality, district, city, [city, district].filter(Boolean).join(" "), [city, locality].filter(Boolean).join(" ")]
    .map(normalizeLocality)
    .filter(Boolean);
  if (exactCandidates.includes(areaNorm)) {
    // A bare municipality row must not beat a more specific Ortsteil when one was geocoded.
    if (hasOrtsteilHint && city && areaNorm === city) score = Math.max(score, 72);
    else score = Math.max(score, 100);
  }

  // "City District" published names vs Photon city + district.
  if (cityTokens.length && districtTokens.length) {
    const composed = [...cityTokens, ...districtTokens];
    if (sequenceMatches(composed, areaTokens) && composed.length === areaTokens.length) score = Math.max(score, 96);
    if (sequenceMatches(cityTokens, areaTokens) && lastTokenIs(areaTokens, districtTokens[districtTokens.length - 1]!)) {
      score = Math.max(score, 94);
    }
  }

  // Ortsteil alone often matches the trailing token of "Parent Ortsteil".
  if (districtTokens.length === 1 && lastTokenIs(areaTokens, districtTokens[0]!)) {
    score = Math.max(score, cityTokens.length && sequenceMatches(cityTokens, areaTokens) ? 92 : 80);
  }
  if (localityTokensList.length === 1 && lastTokenIs(areaTokens, localityTokensList[0]!)) {
    score = Math.max(score, cityTokens.length && sequenceMatches(cityTokens, areaTokens) ? 90 : 78);
  }

  // Parent municipality prefix: "Östringen …", "Ubstadt Weiher …", "Sankt Leon Rot …".
  if (cityTokens.length && sequenceMatches(cityTokens, areaTokens)) {
    const remainder = areaTokens.slice(cityTokens.length);
    if (!remainder.length) {
      score = Math.max(score, district || locality ? 70 : 88);
    } else if (remainder.length === 1 && isCenterAlias(remainder[0]!) && !district && !locality) {
      // Generic town-center zone when geocoder only gave the municipality.
      score = Math.max(score, 86);
    } else if (!district && !locality) {
      score = Math.max(score, 45);
    } else {
      score = Math.max(score, 55);
    }
  }

  // District/locality equals the whole published name (e.g. Hoffenheim under a shared PLZ).
  if (district && areaNorm === district) score = Math.max(score, 93);
  if (locality && areaNorm === locality) score = Math.max(score, 93);

  return score;
}

/**
 * Filter published Liefergebiete for a geocoded place.
 * Returns only confident matches; if several share the top score, all of them
 * (caller shows a picker). Empty means no published area for this PLZ/place.
 */
export function matchDeliveryAreas<T extends { postalCode: string; locality: string }>(
  areas: T[],
  input: PlaceHints,
): T[] {
  const postalCode = input.postalCode.trim();
  const byPostal = areas.filter((area) => area.postalCode === postalCode);
  if (!byPostal.length) return [];

  const city = normalizeLocality(input.city ?? input.locality ?? "");
  const district = distinctHint(input.district, city);
  const locality = distinctHint(input.locality, city);
  // Backward compatible: older callers passed the city as `locality` only.
  const hints = {
    city: city || normalizeLocality(input.locality ?? ""),
    district,
    locality: locality && locality !== city ? locality : "",
  };

  if (!hints.city && !hints.district && !hints.locality) return byPostal;

  const ranked = byPostal
    .map((area) => ({ area, score: scoreDeliveryArea(area.locality, hints) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.area.locality.localeCompare(right.area.locality, "de"));

  if (!ranked.length) return [];

  const best = ranked[0]!.score;
  // Require a clear place signal before auto-narrowing.
  if (best < 70) return ranked.map((entry) => entry.area);

  return ranked.filter((entry) => entry.score === best).map((entry) => entry.area);
}

export function pickDeliveryArea<T extends { postalCode: string; locality: string }>(
  areas: T[],
  input: PlaceHints,
): T | null {
  const matches = matchDeliveryAreas(areas, input);
  if (matches.length !== 1) return null;
  const score = scoreDeliveryArea(matches[0]!.locality, {
    city: input.city ?? input.locality,
    district: input.district,
    locality: input.locality,
  });
  return score >= 80 ? matches[0]! : null;
}

export function evaluateFulfillment(input: {
  fulfillment: "DELIVERY" | "PICKUP";
  subtotalCents: number;
  area: DeliveryAreaRule | null;
  pickupMinimumCents: number;
}): DeliveryDecision {
  if (input.fulfillment === "PICKUP") {
    const minimumOrderCents = input.pickupMinimumCents;
    if (input.subtotalCents < minimumOrderCents) {
      return {
        ok: false,
        code: "MINIMUM",
        minimumOrderCents,
        deliveryFeeCents: 0,
        message: "Der Mindestbestellwert für die Abholung ist noch nicht erreicht.",
      };
    }
    return { ok: true, deliveryFeeCents: 0, minimumOrderCents, area: null };
  }

  if (!input.area) {
    return {
      ok: false,
      code: "AREA",
      message: "Diese Adresse liegt außerhalb der veröffentlichten Liefergebiete.",
    };
  }

  const deliveryFeeCents = input.area.deliveryFeeCents ?? 0;
  if (input.subtotalCents < input.area.minimumOrderCents) {
    return {
      ok: false,
      code: "MINIMUM",
      area: input.area,
      minimumOrderCents: input.area.minimumOrderCents,
      deliveryFeeCents,
      message: "Der Mindestbestellwert für dieses Liefergebiet ist noch nicht erreicht.",
    };
  }

  return {
    ok: true,
    area: input.area,
    deliveryFeeCents,
    minimumOrderCents: input.area.minimumOrderCents,
  };
}
