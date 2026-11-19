"use client";

import { api } from "@/lib/api";
import { formatEuro } from "@/lib/format";
import { ADMIN_STATUS_OPTIONS, statusLabel } from "@pizzablitz/shared";
import { useEffect, useState } from "react";

type Queue = "all" | "pending" | "active" | "completed" | "rejected" | "cancelled";

type OrderItem = {
  id: string;
  quantity: number;
  productName: string;
  variantLabel: string;
  lineTotalCents: number;
  customizationJson: { choices?: { label: string }[]; extras?: { name: string }[] } | null;
};

export type DeskOrder = {
  id: string;
  publicNumber: number;
  orderCode: string;
  status: string;
  fulfillment: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail: string | null;
  street: string;
  postalCode: string;
  city: string;
  distanceKm?: number | null;
  notes: string;
  subtotalCents: number;
  discountCents?: number;
  couponCode?: string | null;
  totalCents: number;
  deliveryFeeCents: number;
  createdAt: string;
  items: OrderItem[];
  deliveryArea?: { locality: string } | null;
  payment?: { method: string; status: string; paidAt?: string | null } | null;
  promisedAt?: string | null;
  statusEvents?: { id: string; status: string; createdAt: string }[];
};

type Page = {
  items: DeskOrder[];
  total: number;
  page: number;
  pageSize: number;
  stats?: {
    pending: number;
    active: number;
    completed: number;
    rejected: number;
    cancelled: number;
    averageDistanceKm: number | null;
    deliveryFeeCents: number;
  };
};

const paymentMethodLabel: Record<string, string> = { CASH: "Bar", PAYPAL: "PayPal", CARD: "Karte", SOFORT: "Sofort" };
const paymentStatusLabel: Record<string, string> = { UNPAID: "Unbezahlt", NOT_CONFIGURED: "Nicht konfiguriert", PENDING: "Offen", PAID: "Bezahlt", FAILED: "Fehlgeschlagen" };
const queues: { id: Queue; label: string }[] = [
  { id: "all", label: "Alle" },
  { id: "pending", label: "Ausstehend" },
  { id: "active", label: "Aktiv" },
  { id: "completed", label: "Abgeschlossen" },
  { id: "rejected", label: "Abgelehnt" },
  { id: "cancelled", label: "Storniert" },
];

function berlinTime(value: string) {
  return new Date(value).toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
}

function isFresh(order: DeskOrder, freshIds: string[]) {
  return order.status === "PENDING" && (freshIds.includes(order.id) || Date.now() - new Date(order.createdAt).getTime() < 15 * 60 * 1000);
}

export function OrderDesk({ mode, refreshKey, freshIds }: { mode: "orders" | "deliveries"; refreshKey: number; freshIds: string[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [fulfillment, setFulfillment] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("newest");
  const [queue, setQueue] = useState<Queue>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<DeskOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function resetPage() {
    setPage(1);
    setSelectedId(null);
  }

  useEffect(() => {
    const params = new URLSearchParams({ sort, page: String(page), pageSize: "20" });
    if (q.trim()) params.set("q", q.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (mode === "orders") {
      if (status) params.set("status", status);
      if (fulfillment) params.set("fulfillment", fulfillment);
    } else {
      params.set("queue", queue);
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    api<Page>(`/api/admin/${mode === "orders" ? "orders" : "deliveries"}?${params.toString()}`)
      .then((next) => { if (!cancelled) setData(next); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Die Liste konnte nicht geladen werden."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode, q, status, fulfillment, from, to, sort, queue, page, refreshKey]);

  useEffect(() => {
    if (!selectedId) { setSelected(null); return; }
    let cancelled = false;
    api<DeskOrder>(`/api/admin/orders/${selectedId}`)
      .then((order) => { if (!cancelled) setSelected(order); })
      .catch(() => { if (!cancelled) setSelected(null); });
    return () => { cancelled = true; };
  }, [selectedId, refreshKey]);

  async function updateStatus(id: string, nextStatus: string) {
    const updated = await api<DeskOrder>(`/api/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
    setSelected(updated);
    setData((current) => current ? { ...current, items: current.items.map((order) => order.id === id ? { ...order, status: updated.status } : order) } : current);
  }

  async function collectCash(id: string) {
    const updated = await api<DeskOrder>(`/api/admin/orders/${id}/payment`, { method: "POST", body: JSON.stringify({ collected: true }) });
    setSelected(updated);
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Suche
          <input value={q} onChange={(event) => { setQ(event.target.value); resetPage(); }} placeholder="Nummer, Name, Telefon" className="mt-1 block w-56 rounded-lg border border-neutral-200 px-3 py-2" />
        </label>
        {mode === "orders" ? (
          <>
            <label className="text-sm">Status
              <select value={status} onChange={(event) => { setStatus(event.target.value); resetPage(); }} className="mt-1 block rounded-lg border border-neutral-200 px-2 py-2">
                <option value="">Alle</option>
                {ADMIN_STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="text-sm">Art
              <select value={fulfillment} onChange={(event) => { setFulfillment(event.target.value); resetPage(); }} className="mt-1 block rounded-lg border border-neutral-200 px-2 py-2">
                <option value="">Alle</option>
                <option value="DELIVERY">Lieferung</option>
                <option value="PICKUP">Abholung</option>
              </select>
            </label>
          </>
        ) : null}
        <label className="text-sm">Von <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); resetPage(); }} className="mt-1 block rounded-lg border border-neutral-200 px-2 py-2" /></label>
        <label className="text-sm">Bis <input type="date" value={to} onChange={(event) => { setTo(event.target.value); resetPage(); }} className="mt-1 block rounded-lg border border-neutral-200 px-2 py-2" /></label>
        <label className="text-sm">Sortierung
          <select value={sort} onChange={(event) => { setSort(event.target.value); resetPage(); }} className="mt-1 block rounded-lg border border-neutral-200 px-2 py-2">
            <option value="newest">Neueste</option>
            <option value="oldest">Älteste</option>
          </select>
        </label>
      </div>
      {mode === "deliveries" && data?.stats ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {queues.filter((item) => item.id !== "all").map((item) => (
            <button key={item.id} type="button" onClick={() => { setQueue(item.id); resetPage(); }} className={`rounded-xl border p-4 text-left shadow-sm ${queue === item.id ? "border-[#C8102E] bg-[#C8102E] text-white" : "border-neutral-200 bg-white"}`}>
              <p className="text-xs uppercase tracking-[0.14em]">{item.label}</p>
              <p className="mt-2 font-display text-3xl">{data.stats?.[item.id as Exclude<Queue, "all">] ?? 0}</p>
            </button>
          ))}
          <article className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Ø Entfernung</p>
            <p className="mt-2 font-display text-3xl">{data.stats.averageDistanceKm == null ? "—" : `${data.stats.averageDistanceKm.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`}</p>
          </article>
          <article className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Liefergebühren</p>
            <p className="mt-2 font-display text-3xl">{formatEuro(data.stats.deliveryFeeCents)}</p>
            <p className="mt-1 text-xs text-neutral-500">Ohne abgelehnte und stornierte Lieferungen</p>
          </article>
        </div>
      ) : null}
      {mode === "deliveries" ? (
        <div className="flex flex-wrap gap-2">
          {queues.map((item) => (
            <button key={item.id} type="button" onClick={() => { setQueue(item.id); resetPage(); }} className={`min-h-10 rounded-lg px-3 text-sm ${queue === item.id ? "bg-[#1C1F22] text-white" : "border border-neutral-200 bg-white"}`}>{item.label}</button>
          ))}
        </div>
      ) : null}
      {error ? <p className="rounded-xl bg-white p-4 text-sm text-[#C8102E]">{error}</p> : null}
      {loading && !data ? <p className="text-sm text-neutral-500">Wird geladen…</p> : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500">
              <tr>
                <th className="p-3">Bestellung</th><th>Kunde</th><th>{mode === "deliveries" ? "Adresse" : "Art"}</th><th>Zeit</th><th>Status</th><th>Summe</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((order) => (
                <tr key={order.id} onClick={() => setSelectedId(order.id)} className={`cursor-pointer border-b border-neutral-100 ${isFresh(order, freshIds) ? "bg-[#C8102E]/10" : selected?.id === order.id ? "bg-neutral-50" : ""}`}>
                  <td className="p-3 font-medium">{order.orderCode}{isFresh(order, freshIds) ? <span className="ml-2 rounded-full bg-[#C8102E] px-2 py-0.5 text-[11px] text-white">Neu</span> : null}</td>
                  <td>{order.customerFirstName} {order.customerLastName}<br /><span className="text-neutral-500">{order.customerPhone}</span></td>
                  <td>{mode === "deliveries" ? <>{order.street}, {order.postalCode} {order.city}<br /><span className="text-neutral-500">{order.deliveryArea?.locality ?? "—"}{typeof order.distanceKm === "number" ? ` · ${order.distanceKm.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km` : ""} · {formatEuro(order.deliveryFeeCents)}</span></> : (order.fulfillment === "DELIVERY" ? "Lieferung" : "Abholung")}</td>
                  <td>{berlinTime(order.createdAt)}</td>
                  <td>{statusLabel(order.status, order.fulfillment)}</td>
                  <td>{formatEuro(order.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && !data.items.length ? <p className="p-6 text-sm text-neutral-500">Keine Einträge für diese Auswahl.</p> : null}
        </div>
        <OrderDetail order={selected} onStatus={updateStatus} onCollect={collectCash} />
      </div>
      <div className="flex items-center justify-between text-sm">
        <p className="text-neutral-500">{data ? `${data.total} Einträge` : ""}</p>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 disabled:opacity-40">Zurück</button>
          <span className="px-2 py-2">{page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 disabled:opacity-40">Weiter</button>
        </div>
      </div>
    </div>
  );
}

function OrderDetail({ order, onStatus, onCollect }: { order: DeskOrder | null; onStatus: (id: string, status: string) => Promise<void>; onCollect: (id: string) => Promise<void> }) {
  if (!order) return <aside className="rounded-xl border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-500">Bestellung auswählen, um die Details zu sehen.</aside>;
  return (
    <aside className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h2 className="font-display text-2xl">{order.orderCode}</h2>
      <p className="text-sm text-neutral-500">{order.customerFirstName} {order.customerLastName} · {order.customerPhone}</p>
      {order.customerEmail ? <p className="text-sm text-neutral-500">{order.customerEmail}</p> : null}
      <p className="mt-2 text-sm">{order.fulfillment === "DELIVERY" ? "Lieferung" : "Abholung"} · {berlinTime(order.createdAt)}</p>
      <p className="text-sm">{order.street}, {order.postalCode} {order.city} {order.deliveryArea ? `· ${order.deliveryArea.locality}` : ""}{typeof order.distanceKm === "number" ? ` · ${order.distanceKm.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km` : ""}</p>
      <label className="mt-3 block text-sm">Status
        <select value={order.status} onChange={(event) => void onStatus(order.id, event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2">
          {ADMIN_STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <ul className="mt-3 space-y-1 text-sm">
        {order.items.map((item) => (
          <li key={item.id}>{item.quantity}× {item.productName} ({item.variantLabel}) · {formatEuro(item.lineTotalCents)}{item.customizationJson?.choices?.length ? ` · ${item.customizationJson.choices.map((choice) => choice.label).join(", ")}` : ""}{item.customizationJson?.extras?.length ? ` · ${item.customizationJson.extras.map((extra) => extra.name).join(", ")}` : ""}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm">Zahlung {paymentMethodLabel[order.payment?.method ?? ""] ?? order.payment?.method} · {paymentStatusLabel[order.payment?.status ?? ""] ?? order.payment?.status}{order.payment?.paidAt ? ` · ${berlinTime(order.payment.paidAt)}` : ""}</p>
      {order.payment?.method === "CASH" && order.payment.status !== "PAID" && order.status !== "REJECTED" && order.status !== "CANCELLED" ? (
        <button type="button" className="mt-2 rounded-lg bg-[#1C1F22] px-3 py-2 text-sm text-white" onClick={() => void onCollect(order.id)}>Als kassiert markieren</button>
      ) : null}
      {order.promisedAt ? <p className="mt-2 text-sm">Zusage bis {berlinTime(order.promisedAt)}</p> : null}
      <p className="text-sm">Zwischensumme {formatEuro(order.subtotalCents)}{order.discountCents ? ` · Gutschein ${order.couponCode ?? ""} −${formatEuro(order.discountCents)}` : ""} · Lieferung {formatEuro(order.deliveryFeeCents)} · Gesamt {formatEuro(order.totalCents)}</p>
      {order.notes ? <p className="mt-2 text-sm text-neutral-600">Hinweis: {order.notes}</p> : null}
      {order.statusEvents?.length ? (
        <ol className="mt-3 space-y-1 text-xs text-neutral-500">
          {order.statusEvents.map((event) => <li key={event.id}>{berlinTime(event.createdAt)} · {statusLabel(event.status, order.fulfillment)}</li>)}
        </ol>
      ) : null}
    </aside>
  );
}
