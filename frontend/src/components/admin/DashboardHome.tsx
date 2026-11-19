"use client";

import { api } from "@/lib/api";
import { formatEuro } from "@/lib/format";
import { isRestaurantOpen, statusLabel, type OpeningHour } from "@pizzablitz/shared";
import { Banknote, ChefHat, Clock3, ShoppingBag, Truck, Wallet, XCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Preset = "today" | "7d" | "30d" | "month" | "custom";
type Granularity = "day" | "week" | "month";

type Analytics = {
  timezone: string;
  range: { from: string; to: string };
  previousRange: { from: string; to: string };
  current: {
    salesCents: number;
    salesCount: number;
    averageOrderCents: number;
    collectedCents: number;
    unpaidCents: number;
    openCount: number;
    completedCount: number;
    deliveryCount: number;
  };
  comparison: Record<"salesCents" | "collectedCents" | "unpaidCents" | "salesCount" | "averageOrderCents" | "openCount" | "completedCount" | "deliveryCount", number | null>;
  series: { bucket: string; salesCents: number; collectedCents: number; unpaidCents: number; salesCount: number; voidCount: number }[];
  fulfillment: { delivery: { count: number; salesCents: number }; pickup: { count: number; salesCents: number } };
  topProducts: { name: string; sku: string; quantity: number; salesCents: number }[];
  categories: { name: string; salesCents: number }[];
  statuses: { status: string; count: number }[];
  peakHours: { hour: number; count: number }[];
  operations: { awaitingAcceptance: number; preparation: number; ready: number; outForDelivery: number };
  pending: { id: string; orderCode: string; customerFirstName: string; customerLastName: string; customerPhone: string; fulfillment: string; totalCents: number; createdAt: string; status: string }[];
  latest: { id: string; orderCode: string; customerFirstName: string; customerLastName: string; totalCents: number; createdAt: string; status: string; fulfillment: string }[];
};

const presets: { id: Preset; label: string }[] = [
  { id: "today", label: "Heute" },
  { id: "7d", label: "Letzte 7 Tage" },
  { id: "30d", label: "Letzte 30 Tage" },
  { id: "month", label: "Dieser Monat" },
  { id: "custom", label: "Eigener Zeitraum" },
];

const money = (cents: number) => cents / 100;
const euroTick = (value: number) => formatEuro(Math.round(value * 100));

function Trend({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-neutral-400">Kein Vergleich</span>;
  const percent = Math.round(value * 100);
  const tone = percent > 0 ? "text-emerald-700" : percent < 0 ? "text-neutral-500" : "text-neutral-400";
  return <span className={`text-xs font-medium ${tone}`}>{percent > 0 ? "↑" : percent < 0 ? "↓" : "→"} {Math.abs(percent)} % zum Vorzeitraum</span>;
}

function Metric({ label, value, hint, trend, icon }: { label: string; value: string; hint: string; trend: number | null; icon: ReactNode }) {
  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">{label}</p>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#C8102E]/10 text-[#C8102E]">{icon}</span>
      </div>
      <p className="mt-3 font-display text-3xl tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{hint}</p>
      <div className="mt-2"><Trend value={trend} /></div>
    </article>
  );
}

export function DashboardHome({ refreshKey, live }: { refreshKey: number; live: boolean }) {
  const [preset, setPreset] = useState<Preset>("today");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<Analytics | null>(null);
  const [open, setOpen] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ preset, granularity });
    if (preset === "custom") {
      if (!from || !to) return;
      params.set("from", from);
      params.set("to", to);
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    api<Analytics>(`/api/admin/analytics?${params.toString()}`)
      .then((next) => { if (!cancelled) setData(next); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Die Auswertung konnte nicht geladen werden."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [preset, granularity, from, to, refreshKey]);

  useEffect(() => {
    api<{ holidayMode: boolean; hours: OpeningHour[] }>("/api/restaurant")
      .then((restaurant) => setOpen(isRestaurantOpen(new Date(), restaurant.hours, restaurant.holidayMode)))
      .catch(() => setOpen(null));
  }, [refreshKey]);

  const todayLabel = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const current = data?.current;
  const peakTotal = data?.peakHours.reduce((sum, hour) => sum + hour.count, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">{todayLabel} · Europe/Berlin</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">Dashboard</h1>
          <p className="mt-2 text-sm text-neutral-600">
            {open === null ? "Öffnungsstatus wird geladen" : open ? "Restaurant ist geöffnet" : "Restaurant ist geschlossen"}
            <span className="mx-2 text-neutral-300">·</span>
            <span className={live ? "text-emerald-700" : "text-neutral-500"}>{live ? "Live verbunden" : "Live getrennt"}</span>
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto lg:max-w-full lg:justify-end">
          {presets.map((item) => (
            <button key={item.id} type="button" onClick={() => setPreset(item.id)} className={`min-h-10 rounded-lg px-3 text-sm ${preset === item.id ? "bg-[#1C1F22] text-white" : "border border-neutral-200 bg-white"}`}>
              {item.label}
            </button>
          ))}
          <select value={granularity} onChange={(event) => setGranularity(event.target.value as Granularity)} className="min-h-10 rounded-lg border border-neutral-200 bg-white px-2 text-sm">
            <option value="day">Tag</option>
            <option value="week">Woche</option>
            <option value="month">Monat</option>
          </select>
        </div>
      </div>
      {preset === "custom" ? (
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">Von <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="ml-2 rounded-lg border border-neutral-200 px-2 py-1" /></label>
          <label className="text-sm">Bis <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="ml-2 rounded-lg border border-neutral-200 px-2 py-1" /></label>
        </div>
      ) : null}
      {error ? <p className="rounded-xl border border-[#C8102E]/20 bg-white p-4 text-sm text-[#C8102E]">{error}</p> : null}
      {loading && !data ? <p className="text-sm text-neutral-500">Auswertung wird geladen…</p> : null}

      {data && current ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Queue label="Wartet auf Annahme" value={data.operations.awaitingAcceptance} tone="alert" icon={<Clock3 className="h-4 w-4" />} />
            <Queue label="In Zubereitung" value={data.operations.preparation} tone="work" icon={<ChefHat className="h-4 w-4" />} />
            <Queue label="Bereit" value={data.operations.ready} tone="work" icon={<ShoppingBag className="h-4 w-4" />} />
            <Queue label="Unterwegs" value={data.operations.outForDelivery} tone="work" icon={<Truck className="h-4 w-4" />} />
          </section>

          <section className="rounded-xl border border-[#C8102E]/30 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
              <h2 className="font-medium">Neue und wartende Bestellungen</h2>
              <span className="rounded-full bg-[#C8102E] px-2 py-0.5 text-xs font-semibold text-white">{data.operations.awaitingAcceptance}</span>
            </div>
            {data.pending.length ? (
              <ul className="divide-y divide-neutral-100">
                {data.pending.map((order) => {
                  const fresh = Date.now() - new Date(order.createdAt).getTime() < 15 * 60 * 1000;
                  return (
                    <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-[#C8102E] px-4 py-3">
                      <div>
                        <p className="font-medium">{order.orderCode} · {order.customerFirstName} {order.customerLastName}</p>
                        <p className="text-sm text-neutral-500">{order.customerPhone} · {order.fulfillment === "DELIVERY" ? "Lieferung" : "Abholung"} · {new Date(order.createdAt).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}</p>
                      </div>
                      <div className="text-right">
                        {fresh ? <span className="mr-2 rounded-full bg-[#C8102E] px-2 py-0.5 text-xs font-semibold text-white">Neu</span> : null}
                        <span className="font-medium">{formatEuro(order.totalCents)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="px-4 py-6 text-sm text-neutral-500">Keine Bestellung wartet auf Annahme.</p>}
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Gesamtumsatz" value={formatEuro(current.salesCents)} hint="Ohne abgelehnte und stornierte Bestellungen" trend={data.comparison.salesCents} icon={<Banknote className="h-4 w-4" />} />
            <Metric label="Kassiert" value={formatEuro(current.collectedCents)} hint="Nur bestätigte Zahlungen" trend={data.comparison.collectedCents} icon={<Wallet className="h-4 w-4" />} />
            <Metric label="Unbezahlt" value={formatEuro(current.unpaidCents)} hint="Offene Forderung, nicht kassiert" trend={data.comparison.unpaidCents} icon={<Clock3 className="h-4 w-4" />} />
            <Metric label="Bestellungen" value={String(current.salesCount)} hint="Gewertete Bestellungen" trend={data.comparison.salesCount} icon={<ShoppingBag className="h-4 w-4" />} />
            <Metric label="Offene Bestellungen" value={String(current.openCount)} hint="Annahme, Zubereitung, bereit, unterwegs" trend={data.comparison.openCount} icon={<Clock3 className="h-4 w-4" />} />
            <Metric label="Abgeschlossen" value={String(current.completedCount)} hint="Status geliefert oder abgeholt" trend={data.comparison.completedCount} icon={<ShoppingBag className="h-4 w-4" />} />
            <Metric label="Ø Bestellwert" value={formatEuro(current.averageOrderCents)} hint="Umsatz geteilt durch gewertete Bestellungen" trend={data.comparison.averageOrderCents} icon={<Banknote className="h-4 w-4" />} />
            <Metric label="Lieferungen" value={String(current.deliveryCount)} hint="Gewertete Lieferbestellungen" trend={data.comparison.deliveryCount} icon={<Truck className="h-4 w-4" />} />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Umsatz, kassiert und unbezahlt">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.series.map((row) => ({ ...row, sales: money(row.salesCents), collected: money(row.collectedCents), unpaid: money(row.unpaidCents) }))}>
                  <CartesianGrid stroke="#eee" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={euroTick} tick={{ fontSize: 11 }} width={72} />
                  <Tooltip formatter={(value) => formatEuro(Math.round(Number(value) * 100))} />
                  <Legend />
                  <Bar dataKey="sales" name="Umsatz" fill="#C8102E" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="collected" name="Kassiert" fill="#1F7A4D" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="unpaid" name="Unbezahlt" fill="#C47B0A" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Bestellvolumen">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.series}>
                  <CartesianGrid stroke="#eee" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="salesCount" name="Gewertet" fill="#1C1F22" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="voidCount" name="Abgelehnt oder storniert" fill="#D4D4D8" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Lieferung und Abholung">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={[{ name: "Lieferung", value: data.fulfillment.delivery.count }, { name: "Abholung", value: data.fulfillment.pickup.count }]} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84}>
                    <Cell fill="#C8102E" />
                    <Cell fill="#1C1F22" />
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <p className="px-4 pb-4 text-xs text-neutral-500">Lieferung {formatEuro(data.fulfillment.delivery.salesCents)} · Abholung {formatEuro(data.fulfillment.pickup.salesCents)}</p>
            </ChartCard>
            <ChartCard title="Statusverteilung">
              {data.statuses.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.statuses.map((row) => ({ name: statusLabel(row.status), count: row.count }))} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid stroke="#eee" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Bestellungen" fill="#C8102E" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>
            <ChartCard title="Meistverkaufte Produkte">
              {data.topProducts.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.topProducts} layout="vertical" margin={{ left: 16 }}>
                    <CartesianGrid stroke="#eee" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="quantity" name="Menge" fill="#1C1F22" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>
            <ChartCard title="Umsatz nach Kategorie">
              {data.categories.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.categories.map((row) => ({ ...row, sales: money(row.salesCents) }))} layout="vertical" margin={{ left: 16 }}>
                    <CartesianGrid stroke="#eee" horizontal={false} />
                    <XAxis type="number" tickFormatter={euroTick} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatEuro(Math.round(Number(value) * 100))} />
                    <Bar dataKey="sales" name="Umsatz" fill="#C8102E" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
              <h2 className="border-b border-neutral-100 px-4 py-3 font-medium">Letzte Bestellungen im Zeitraum</h2>
              {data.latest.length ? (
                <ul className="divide-y divide-neutral-100 text-sm">
                  {data.latest.map((order) => (
                    <li key={order.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${order.status === "PENDING" ? "bg-[#C8102E]/5" : ""}`}>
                      <span>{order.orderCode} · {order.customerFirstName} {order.customerLastName}<br /><span className="text-neutral-500">{statusLabel(order.status, order.fulfillment)}</span></span>
                      <span>{formatEuro(order.totalCents)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="px-4 py-6 text-sm text-neutral-500">In diesem Zeitraum gibt es keine Bestellungen.</p>}
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
              <h2 className="border-b border-neutral-100 px-4 py-3 font-medium">Bestellstunden</h2>
              {peakTotal > 0 ? (
                <div className="p-3">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.peakHours.map((hour) => ({ hour: `${String(hour.hour).padStart(2, "0")}:00`, count: hour.count }))}>
                      <CartesianGrid stroke="#eee" vertical={false} />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                      <Tooltip />
                      <Bar dataKey="count" name="Bestellungen" fill="#1C1F22" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="px-4 py-6 text-sm text-neutral-500">Für diesen Zeitraum liegen noch keine gewerteten Bestellungen vor.</p>}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Queue({ label, value, tone, icon }: { label: string; value: number; tone: "alert" | "work"; icon: ReactNode }) {
  const active = value > 0 && tone === "alert";
  return (
    <article className={`rounded-xl border p-4 shadow-sm ${active ? "border-[#C8102E] bg-[#C8102E] text-white" : "border-neutral-200 bg-white"}`}>
      <div className={`flex items-center gap-2 text-xs uppercase tracking-[0.14em] ${active ? "text-white/80" : "text-neutral-500"}`}>{icon}{label}</div>
      <p className="mt-2 font-display text-4xl">{value}</p>
      <p className={`mt-1 text-xs ${active ? "text-white/80" : "text-neutral-500"}`}>Aktuelle Küche, unabhängig vom Zeitraum</p>
    </article>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm">
      <h2 className="border-b border-neutral-100 px-4 py-3 font-medium">{title}</h2>
      <div className="p-3">{children}</div>
    </section>
  );
}

function EmptyChart() {
  return <p className="flex min-h-40 items-center gap-2 px-4 py-8 text-sm text-neutral-500"><XCircle className="h-4 w-4" /> Keine Daten in diesem Zeitraum.</p>;
}
