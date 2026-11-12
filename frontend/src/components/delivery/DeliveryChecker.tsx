"use client";

import { api } from "@/lib/api";
import { formatEuro } from "@/lib/format";
import { useState } from "react";

type Area = { id: string; postalCode: string; locality: string; minimumOrderCents: number; deliveryFeeCents: number | null };

type CheckResult = {
  matches: Area[];
  needsLocality: boolean;
  decision: { ok: boolean; code?: string; message?: string; minimumOrderCents?: number; deliveryFeeCents?: number };
};

export function DeliveryChecker({ areas }: { areas: Area[] }) {
  const [postalCode, setPostalCode] = useState("");
  const [locality, setLocality] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState("");
  const known = areas.filter((area) => area.postalCode === postalCode);

  async function check(nextLocality = locality) {
    setError("");
    try {
      const data = await api<CheckResult>("/api/delivery/check", {
        method: "POST",
        body: JSON.stringify({ postalCode, locality: nextLocality || undefined }),
      });
      setResult(data);
    } catch {
      const matches = areas.filter((area) => area.postalCode === postalCode && (!nextLocality || area.locality.toLowerCase() === nextLocality.toLowerCase()));
      if (postalCode.length !== 5) {
        setResult(null);
        setError("Bitte eine fünfstellige Postleitzahl eingeben.");
        return;
      }
      const chosen = nextLocality ? matches[0] ?? null : matches.length === 1 ? matches[0] : null;
      setResult({
        matches,
        needsLocality: !nextLocality && matches.length > 1,
        decision: chosen
          ? { ok: true, minimumOrderCents: chosen.minimumOrderCents, deliveryFeeCents: chosen.deliveryFeeCents ?? 0 }
          : { ok: false, code: "AREA", message: "Diese Adresse liegt außerhalb der veröffentlichten Liefergebiete." },
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
      <label className="text-sm font-medium" htmlFor="plz">
        Postleitzahl
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="plz"
          inputMode="numeric"
          maxLength={5}
          value={postalCode}
          onChange={(event) => {
            setPostalCode(event.target.value.replace(/\D/g, "").slice(0, 5));
            setLocality("");
            setResult(null);
          }}
          className="w-full border border-ink/15 px-3 py-3"
          placeholder="76684"
        />
        <button type="submit" className="min-h-12 shrink-0 rounded-full bg-brand px-5 text-sm font-semibold text-white">
          Prüfen
        </button>
      </div>
      {known.length > 1 ? (
        <div className="mt-3 grid gap-2">
          {known.map((area) => (
            <button
              key={area.id}
              type="button"
              onClick={() => {
                setLocality(area.locality);
                void check(area.locality);
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
      {result ? (
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
