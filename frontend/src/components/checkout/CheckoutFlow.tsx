"use client";

import { AddressLookup, type AddressSuggestion } from "@/components/delivery/AddressLookup";
import { api } from "@/lib/api";
import { openSocket, type LiveSocket } from "@/lib/realtime";
import { formatEuro } from "@/lib/format";
import { priceCartLine, useCart } from "@/store/cart";
import type { Restaurant } from "@/types/catalog";
import { customerStatusMessage, OUTSIDE_DELIVERY_RADIUS_MESSAGE, statusLabel, withinDeliveryRadius } from "@pizzablitz/shared";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Method = { method: "CASH" | "PAYPAL" | "CARD" | "SOFORT"; label: string; available: boolean; reason: string | null };
type Area = { id: string; postalCode: string; locality: string; minimumOrderCents: number; deliveryFeeCents: number | null };
type Quote = { subtotalCents: number; deliveryFeeCents: number; totalCents: number; minimumOrderCents: number; distanceKm?: number | null };

const steps = ["Lieferung", "Kontakt", "Adresse", "Hinweise", "Zahlung", "Prüfen"];

export function CheckoutFlow({ restaurant }: { restaurant: Restaurant }) {
  const lines = useCart((state) => state.lines);
  const clear = useCart((state) => state.clear);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(0);
  const [fulfillment, setFulfillment] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [customer, setCustomer] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [address, setAddress] = useState({ street: "", postalCode: "", city: "" });
  const [place, setPlace] = useState<AddressSuggestion | null>(null);
  const [areaId, setAreaId] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<Method["method"]>("CASH");
  const [methods, setMethods] = useState<Method[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState("PENDING");
  const [trackingToken, setTrackingToken] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + priceCartLine(line).lineTotalCents, 0), [lines]);
  const matches = areas.filter((area) => area.postalCode === address.postalCode);

  useEffect(() => {
    setHydrated(useCart.persist.hasHydrated());
    return useCart.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!trackingToken || !orderId) return;
    let stopped = false;
    let socket: LiveSocket | null = null;
    let poll = 0;
    const refresh = async () => {
      try {
        const order = await api<{ status: string }>(`/api/orders/track/${trackingToken}`);
        if (!stopped) setOrderStatus(order.status);
      } catch {
        // The confirmation stays visible if a status refresh fails.
      }
    };
    const startPoll = () => {
      if (!poll) poll = window.setInterval(() => void refresh(), 15000);
    };
    socket = openSocket({ trackingToken });
    socket.on("connect", () => {
      setLive(true);
      if (poll) window.clearInterval(poll);
      poll = 0;
      void refresh();
      socket?.emit("order:watch", { orderId, trackingToken });
    });
    socket.on("disconnect", () => {
      setLive(false);
      void refresh();
      startPoll();
    });
    socket.on("connect_error", () => {
      setLive(false);
      startPoll();
    });
    socket.on("order:status", (event: { orderId: string; status: string }) => {
      if (event.orderId === orderId) setOrderStatus(event.status);
    });
    return () => {
      stopped = true;
      if (poll) window.clearInterval(poll);
      socket?.disconnect();
      setLive(false);
    };
  }, [trackingToken, orderId]);

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
          latitude: place?.latitude,
          longitude: place?.longitude,
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
      const order = await api<{ id: string; publicNumber: number; status: string; trackingToken?: string }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          fulfillment,
          idempotencyKey: idempotencyKey.current,
          postalCode: address.postalCode,
          deliveryAreaId: fulfillment === "DELIVERY" ? areaId : undefined,
          customer,
          address: fulfillment === "DELIVERY" ? { ...address, latitude: place?.latitude, longitude: place?.longitude } : { street: "", postalCode: "", city: "" },
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
      setOrderId(order.id);
      setOrderStatus(order.status);
      setTrackingToken(order.trackingToken ?? null);
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
          {customerStatusMessage(orderStatus, fulfillment)} Der Status wird hier aktualisiert. Es wird keine E-Mail und keine SMS verschickt. Bei Barzahlung wird der Betrag bei Übergabe kassiert.
        </p>
        <p className="mt-3 text-sm">{statusLabel(orderStatus, fulfillment)}</p>
        <p className="mt-1 text-xs text-mute">{live ? "Live verbunden" : "Live getrennt, der Status wird weiterhin abgefragt."}</p>
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
                {field === "firstName" ? "Vorname" : field === "lastName" ? "Nachname" : field === "email" ? "E-Mail (optional)" : "Telefon"}
                <input className="mt-1 w-full border border-ink/15 px-3 py-3" value={customer[field]} onChange={(event) => setCustomer({ ...customer, [field]: event.target.value })} />
              </label>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-6 grid gap-3">
            {fulfillment === "DELIVERY" ? (
              <>
                <AddressLookup
                  shop={restaurant}
                  selected={place}
                  onClear={() => {
                    setPlace(null);
                    setAddress({ street: "", postalCode: "", city: "" });
                    setAreaId("");
                  }}
                  onSelect={(suggestion) => {
                    setPlace(suggestion);
                    setAddress({ street: suggestion.street, postalCode: suggestion.postalCode, city: suggestion.city });
                    const postalMatches = areas.filter((area) => area.postalCode === suggestion.postalCode);
                    const cityMatch = postalMatches.find((area) => area.locality.toLowerCase() === suggestion.city.toLowerCase());
                    setAreaId(cityMatch?.id ?? (postalMatches.length === 1 ? postalMatches[0].id : ""));
                  }}
                />
                {place && withinDeliveryRadius(restaurant, place) ? (
                <div className="grid gap-2">
                  {matches.map((area) => (
                    <button key={area.id} type="button" onClick={() => setAreaId(area.id)} className={`border px-3 py-3 text-left text-sm ${areaId === area.id ? "border-brand" : "border-ink/10"}`}>
                      {area.locality} · Mindestbestellwert {formatEuro(area.minimumOrderCents)}
                      {area.deliveryFeeCents == null ? " · keine veröffentlichte Liefergebühr" : ` · ${formatEuro(area.deliveryFeeCents)} Liefergebühr`}
                    </button>
                  ))}
                  {address.postalCode.length === 5 && matches.length === 0 ? <p className="text-sm text-brand">Diese Adresse liegt außerhalb der veröffentlichten Liefergebiete.</p> : null}
                  {matches.length > 1 && !areaId ? <p className="text-sm text-mute">Bitte den passenden Ort auswählen.</p> : null}
                </div>
                ) : null}
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
            {quote.distanceKm != null ? <p className="mt-2 text-sm text-mute">Entfernung zum Shop: {quote.distanceKm.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km</p> : null}
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
                if (step === 1) {
                  const email = customer.email.trim();
                  const phone = customer.phone.trim();
                  const digits = phone.replace(/\D/g, "");
                  if (!customer.firstName.trim() || !customer.lastName.trim()) {
                    setError("Bitte Vorname und Nachname ausfüllen.");
                    return;
                  }
                  if (digits.length < 6 || digits.length > 15 || !/^\+?[0-9][0-9\s()/-]*$/.test(phone)) {
                    setError("Bitte eine gültige Telefonnummer angeben.");
                    return;
                  }
                  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    setError("Die E-Mail-Adresse ist ungültig.");
                    return;
                  }
                }
                if (step === 2 && fulfillment === "DELIVERY") {
                  if (!place) {
                    setError("Bitte eine Adresse aus den Vorschlägen auswählen.");
                    return;
                  }
                  if (!withinDeliveryRadius(restaurant, place)) {
                    setError(OUTSIDE_DELIVERY_RADIUS_MESSAGE);
                    return;
                  }
                  if (!areaId) {
                    setError("Diese Adresse liegt außerhalb der veröffentlichten Liefergebiete.");
                    return;
                  }
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
