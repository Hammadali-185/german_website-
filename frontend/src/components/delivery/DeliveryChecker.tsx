"use client";

import { AddressLookup, type AddressSuggestion } from "@/components/delivery/AddressLookup";
import { api } from "@/lib/api";
import { formatEuro } from "@/lib/format";
import { matchDeliveryAreas, pickDeliveryArea, withinDeliveryRadius, type GeoPoint } from "@pizzablitz/shared";
import { useMemo, useState } from "react";

type Area = { id: string; postalCode: string; locality: string; minimumOrderCents: number; deliveryFeeCents: number | null };

type CheckResult = {
  matches: Area[];
  needsLocality: boolean;
  decision: { ok: boolean; code?: string; message?: string; minimumOrderCents?: number; deliveryFeeCents?: number };
};

export function DeliveryChecker({ areas, shop }: { areas: Area[]; shop: GeoPoint }) {
  const [postalCode, setPostalCode] = useState("");
  const [locality, setLocality] = useState("");
  const [district, setDistrict] = useState("");
  const [place, setPlace] = useState<AddressSuggestion | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState("");
  const known = useMemo(() => {
    const matched = matchDeliveryAreas(areas, { postalCode, city: locality, district, locality: place?.locality });
    return matched.length ? matched : areas.filter((area) => area.postalCode === postalCode);
  }, [areas, postalCode, locality, district, place?.locality]);
  const outside = place ? !withinDeliveryRadius(shop, place) : false;

  async function check(nextPostal = postalCode, nextCity = locality, nextDistrict = district, nextLocality = place?.locality ?? "") {
    setError("");
    try {
      const data = await api<CheckResult>("/api/delivery/check", {
        method: "POST",
        body: JSON.stringify({
          postalCode: nextPostal,
          city: nextCity || undefined,
          locality: nextLocality || nextCity || undefined,
          district: nextDistrict || undefined,
        }),
      });
      setResult(data);
    } catch {
      if (nextPostal.length !== 5) {
        setResult(null);
        setError("Bitte eine fünfstellige Postleitzahl eingeben.");
        return;
      }
      const placeHints = {
        postalCode: nextPostal,
        city: nextCity,
        district: nextDistrict,
        locality: nextLocality,
      };
      const byPostal = areas.filter((area) => area.postalCode === nextPostal);
      const matched = matchDeliveryAreas(areas, placeHints);
      const chosen = pickDeliveryArea(areas, placeHints);
      const matches = matched.length ? matched : byPostal;
      setResult({
        matches,
        needsLocality: !chosen && matches.length > 1,
        decision: chosen
          ? { ok: true, minimumOrderCents: chosen.minimumOrderCents, deliveryFeeCents: chosen.deliveryFeeCents ?? 0 }
          : {
              ok: false,
              code: "AREA",
              message: matches.length
                ? "Bitte den Ort auswählen. Diese Postleitzahl hat mehrere Liefergebiete."
                : "Diese Adresse liegt außerhalb der veröffentlichten Liefergebiete.",
            },
      });
    }
  }

  return (
    <form
      className="rounded-3xl bg-white p-5 shadow-card"
      onSubmit={(event) => {
        event.preventDefault();
        void check();
      }}
    >
      <AddressLookup
        shop={shop}
        selected={place}
        onClear={() => {
          setPlace(null);
          setPostalCode("");
          setLocality("");
          setDistrict("");
          setResult(null);
          setError("");
        }}
        onSelect={(suggestion) => {
          setPlace(suggestion);
          setPostalCode(suggestion.postalCode);
          setLocality(suggestion.city);
          setDistrict(suggestion.district ?? "");
          setResult(null);
          if (withinDeliveryRadius(shop, suggestion) && /^\d{5}$/.test(suggestion.postalCode)) {
            void check(suggestion.postalCode, suggestion.city, suggestion.district ?? "", suggestion.locality ?? "");
          }
        }}
      />
      {!outside && known.length > 1 ? (
        <div className="mt-3 grid gap-2">
          {known.map((area) => (
            <button
              key={area.id}
              type="button"
              onClick={() => {
                setLocality(area.locality);
                setDistrict("");
                void check(area.postalCode, area.locality, "", area.locality);
              }}
              className={`min-h-11 border px-3 py-2 text-left text-sm ${locality === area.locality ? "border-brand" : "border-ink/10"}`}
            >
              {area.postalCode} {area.locality} · Mindestbestellwert {formatEuro(area.minimumOrderCents)}
              {area.deliveryFeeCents == null ? "" : ` · Liefergebühr ${formatEuro(area.deliveryFeeCents)}`}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-brand">{error}</p> : null}
      {outside ? null : result ? (
        <div className="mt-4 text-sm">
          {result.needsLocality ? <p>Bitte den Ort auswählen. Diese Postleitzahl hat mehrere Liefergebiete.</p> : null}
          {result.matches.length === 0 ? <p>Außerhalb der veröffentlichten Liefergebiete. Abholung in Östringen ist möglich.</p> : null}
          {result.matches.length === 1 || locality ? (
            <p>
              {result.decision.ok
                ? `Lieferung möglich. Mindestbestellwert ${formatEuro(result.decision.minimumOrderCents ?? 0)}. ${
                    result.decision.deliveryFeeCents
                      ? `Liefergebühr ${formatEuro(result.decision.deliveryFeeCents)}.`
                      : "Keine Liefergebühr veröffentlicht."
                  }`
                : result.decision.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
