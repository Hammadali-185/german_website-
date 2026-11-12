"use client";

import { api } from "@/lib/api";
import { formatEuro } from "@/lib/format";
import { priceCartLine, useCart } from "@/store/cart";
import type { Restaurant } from "@/types/catalog";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Method = { method: "CASH" | "PAYPAL" | "CARD" | "SOFORT"; label: string; available: boolean; reason: string | null };
type Area = { id: string; postalCode: string; locality: string; minimumOrderCents: number; deliveryFeeCents: number | null };
type Quote = { subtotalCents: number; deliveryFeeCents: number; totalCents: number; minimumOrderCents: number };

const steps = ["Lieferung", "Kontakt", "Adresse", "Hinweise", "Zahlung", "Prüfen"];

export function CheckoutFlow({ restaurant }: { restaurant: Restaurant }) {
  const lines = useCart((state) => state.lines);
  const clear = useCart((state) => state.clear);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(0);
  const [fulfillment, setFulfillment] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [customer, setCustomer] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [address, setAddress] = useState({ street: "", postalCode: "", city: "" });
  const [areaId, setAreaId] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<Method["method"]>("CASH");
  const [methods, setMethods] = useState<Method[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + priceCartLine(line).lineTotalCents, 0), [lines]);
  const matches = areas.filter((area) => area.postalCode === address.postalCode);

  useEffect(() => {
    setHydrated(useCart.persist.hasHydrated());
    return useCart.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    api<Area[]>("/api/delivery/areas")
      .then(setAreas)
      .catch(() => setAreas([]));
    api<Method[]>("/api/payments/methods")
      .then(setMethods)
      .catch(() => setMethods([]));
  }, []);

  async function review() {
    setError("");
    try {
      const next = await api<Quote>("/api/orders/quote", {
        method: "POST",
        body: JSON.stringify({
          fulfillment,
          postalCode: address.postalCode,
          deliveryAreaId: fulfillment === "DELIVERY" ? areaId : undefined,
          items: lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
            choiceOptionIds: line.choices.map((choice) => choice.id),
            extraIds: line.extras.map((extra) => extra.id),
          })),
        }),
      });
      setQuote(next);
      setStep(5);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Die Bestellung kann nicht berechnet werden.");
    }
  }

  async function confirm() {
    setSubmitting(true);
    setError("");
    try {
      const order = await api<{ publicNumber: number }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          fulfillment,
          postalCode: address.postalCode,
          deliveryAreaId: fulfillment === "DELIVERY" ? areaId : undefined,
          customer,
          address,
          notes,
          paymentMethod,
          items: lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
            choiceOptionIds: line.choices.map((choice) => choice.id),
            extraIds: line.extras.map((extra) => extra.id),
          })),
        }),
      });
      setOrderNumber(order.publicNumber);
      clear();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Die Bestellung wurde nicht gespeichert.");
    } finally {
      setSubmitting(false);
    }
  }

  if (orderNumber) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-brand">Bestellung aufgenommen</p>
        <h1 className="mt-3 font-display text-5xl">Nr. {orderNumber}</h1>
        <p className="mt-4 text-mute">
          Die Bestellung ist gespeichert und wartet auf Bestätigung im Restaurant. Bei Barzahlung wird der Betrag bei Übergabe kassiert. Es wurde keine Online-Zahlung ausgeführt
          {restaurant.email ? "." : " und keine E-Mail verschickt, weil keine Restaurant-E-Mail hinterlegt ist."}
        </p>
        <Link href="/menu" className="mt-8 inline-block bg-brand px-5 py-3 text-sm font-semibold text-white">
          Zurück zur Karte
        </Link>
      </div>
    );
  }

  if (!hydrated) {
    return <p className="px-4 py-16 text-center text-mute">Warenkorb wird geladen.</p>;
  }

  if (!lines.length) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <h1 className="font-display text-5xl">Warenkorb ist leer</h1>
        <Link href="/menu" className="mt-6 inline-block text-brand">
          Speisekarte öffnen
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[1fr_280px]">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-mute">
          Schritt {step + 1} von {steps.length}: {steps[step]}
        </p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl">Kasse</h1>
        {!restaurant.open ? <p className="mt-4 bg-white p-4 text-sm">Das Restaurant hat nach den veröffentlichten Zeiten derzeit geschlossen. Die Bestellung wird vom Server abgelehnt.</p> : null}
        {lines.some((line) => !line.orderingEnabled) ? (
          <p className="mt-4 bg-white p-4 text-sm">Diese Artikel stammen aus der lokalen Datei und haben noch keine Datenbank-IDs. Starte die API, damit die Bestellung gespeichert werden kann.</p>
        ) : null}

        {step === 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {(["DELIVERY", "PICKUP"] as const).map((value) => (
              <button key={value} type="button" onClick={() => setFulfillment(value)} className={`border p-5 text-left ${fulfillment === value ? "border-brand bg-white" : "border-ink/10"}`}>
                <span className="font-display text-3xl">{value === "DELIVERY" ? "Lieferung" : "Abholung"}</span>
                <span className="mt-2 block text-sm text-mute">{value === "DELIVERY" ? "In ein veröffentlichtes Liefergebiet." : `${restaurant.street}, ${restaurant.postalCode} ${restaurant.city}`}</span>
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {(["firstName", "lastName", "email", "phone"] as const).map((field) => (
              <label key={field} className="text-sm">
                {field === "firstName" ? "Vorname" : field === "lastName" ? "Nachname" : field === "email" ? "E-Mail" : "Telefon"}
                <input className="mt-1 w-full border border-ink/15 px-3 py-3" value={customer[field]} onChange={(event) => setCustomer({ ...customer, [field]: event.target.value })} />
              </label>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-6 grid gap-3">
            {fulfillment === "DELIVERY" ? (
              <>
                <input className="border border-ink/15 px-3 py-3" placeholder="Straße und Hausnummer" value={address.street} onChange={(event) => setAddress({ ...address, street: event.target.value })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="border border-ink/15 px-3 py-3" placeholder="PLZ" value={address.postalCode} onChange={(event) => setAddress({ ...address, postalCode: event.target.value.replace(/\D/g, "").slice(0, 5) })} />
                  <input className="border border-ink/15 px-3 py-3" placeholder="Ort" value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  {matches.map((area) => (
                    <button key={area.id} type="button" onClick={() => setAreaId(area.id)} className={`border px-3 py-3 text-left text-sm ${areaId === area.id ? "border-brand" : "border-ink/10"}`}>
                      {area.locality} · Mindestbestellwert {formatEuro(area.minimumOrderCents)}
                      {area.deliveryFeeCents == null ? " · keine veröffentlichte Liefergebühr" : ` · ${formatEuro(area.deliveryFeeCents)} Liefergebühr`}
                    </button>
                  ))}
                  {address.postalCode.length === 5 && matches.length === 0 ? <p className="text-sm text-brand">Diese Postleitzahl ist nicht im Liefergebiet.</p> : null}
                </div>
              </>
            ) : (
              <p className="bg-white p-4 text-sm">Abholung bei {restaurant.tradeName}, {restaurant.street}, {restaurant.postalCode} {restaurant.city}.</p>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <textarea className="mt-6 min-h-32 w-full border border-ink/15 p-3" placeholder="Lieferhinweis, optional" value={notes} onChange={(event) => setNotes(event.target.value)} />
        ) : null}

        {step === 4 ? (
          <div className="mt-6 grid gap-3">
            {methods.map((method) => (
              <label key={method.method} className={`border p-4 ${!method.available ? "opacity-60" : ""}`}>
                <input type="radio" name="payment" disabled={!method.available} checked={paymentMethod === method.method} onChange={() => setPaymentMethod(method.method)} />
                <span className="ml-2">{method.label}</span>
                {!method.available && method.reason ? <span className="mt-1 block text-sm text-mute">{method.reason}</span> : null}
              </label>
            ))}
          </div>
        ) : null}

        {step === 5 && quote ? (
          <div className="mt-6 bg-white p-5">
            <p className="flex justify-between text-sm"><span>Zwischensumme</span><span>{formatEuro(quote.subtotalCents)}</span></p>
            <p className="mt-2 flex justify-between text-sm"><span>Liefergebühr</span><span>{formatEuro(quote.deliveryFeeCents)}</span></p>
            <p className="mt-4 flex flex-wrap items-end justify-between gap-2 font-display text-3xl"><span>Gesamt</span><span>{formatEuro(quote.totalCents)}</span></p>
            <p className="mt-3 text-xs text-mute">Der Betrag wurde vom Server aus der aktuellen Karte berechnet.</p>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-brand">{error}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          {step > 0 ? <button type="button" className="min-h-12 border border-ink/15 px-4 sm:w-auto" onClick={() => setStep((value) => value - 1)}>Zurück</button> : null}
          {step < 4 ? (
            <button
              type="button"
              className="min-h-12 bg-ink px-4 text-cream sm:w-auto"
              onClick={() => {
                if (step === 1 && (!customer.firstName || !customer.lastName || !customer.email || customer.phone.length < 6)) {
                  setError("Bitte die Kontaktdaten vollständig ausfüllen.");
                  return;
                }
                if (step === 2 && fulfillment === "DELIVERY" && (address.street.length < 3 || !areaId)) {
                  setError("Bitte Straße und Liefergebiet wählen.");
                  return;
                }
                setError("");
                setStep((value) => value + 1);
              }}
            >
              Weiter
            </button>
          ) : null}
          {step === 4 ? <button type="button" className="min-h-12 bg-ink px-4 text-cream" onClick={() => void review()}>Summe prüfen</button> : null}
          {step === 5 ? (
            <button type="button" disabled={submitting || !restaurant.open || lines.some((line) => !line.orderingEnabled)} className="min-h-12 bg-brand px-4 text-white disabled:opacity-40" onClick={() => void confirm()}>
              {submitting ? "Wird gespeichert" : "Verbindlich bestellen"}
            </button>
          ) : null}
        </div>
      </div>
      <aside className="bg-white p-4 text-sm">
        <p className="font-medium">Deine Auswahl</p>
        <p className="mt-2 text-mute">Anzeige im Browser: {formatEuro(subtotal)}</p>
        <ul className="mt-3 space-y-2">
          {lines.map((line) => (
            <li key={line.key}>{line.quantity}× {line.name}</li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
