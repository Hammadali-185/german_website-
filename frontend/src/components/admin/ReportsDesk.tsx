"use client";

import { api } from "@/lib/api";
import { formatEuro } from "@/lib/format";
import { useEffect, useState, type ReactNode } from "react";

type Report = {
  timezone: string;
  range: { from: string; to: string };
  current: {
    salesCents: number; salesCount: number; averageOrderCents: number; collectedCents: number; collectedCount: number;
    unpaidCents: number; unpaidCount: number; orderCount: number;
  };
  series: { bucket: string; salesCents: number; collectedCents: number; unpaidCents: number; salesCount: number }[];
  fulfillment: { delivery: { count: number; salesCents: number }; pickup: { count: number; salesCents: number } };
  topProducts: { name: string; sku: string; quantity: number; salesCents: number }[];
  categories: { name: string; salesCents: number }[];
  voids: { rejected: number; cancelled: number };
  deliveryPerformance: { completed: number; rejected: number; cancelled: number; feeCents: number; averageDistanceKm: number; measured: number; onTime: number; late: number; unmeasured: number; onTimeRatio: number | null; note: string };
};

export function ReportsDesk({ refreshKey = 0 }: { refreshKey?: number }) {
  const [preset, setPreset] = useState("30d");
  const [granularity, setGranularity] = useState("day");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ preset, granularity });
    if (preset === "custom") {
      if (!from || !to) return;
      params.set("from", from);
      params.set("to", to);
    }
    let cancelled = false;
    api<Report>(`/api/admin/reports?${params.toString()}`)
      .then((next) => { if (!cancelled) { setReport(next); setError(""); } })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Der Bericht konnte nicht geladen werden."); });
    return () => { cancelled = true; };
  }, [preset, granularity, from, to, refreshKey]);

  async function download() {
    const params = new URLSearchParams({ preset, granularity });
    if (preset === "custom") { params.set("from", from); params.set("to", to); }
    const response = await fetch(`/api/admin/reports.csv?${params.toString()}`, { credentials: "include" });
    if (!response.ok) { setError("Der Export wurde abgelehnt."); return; }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bericht-${report?.range.from ?? "export"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const current = report?.current;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <select value={preset} onChange={(event) => setPreset(event.target.value)} className="rounded-lg border border-neutral-200 px-2 py-2">
          <option value="today">Heute</option>
          <option value="7d">7 Tage</option>
          <option value="30d">30 Tage</option>
          <option value="month">Dieser Monat</option>
          <option value="custom">Eigener Zeitraum</option>
        </select>
        {preset === "custom" ? (
          <>
            <label className="text-sm">Von <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block rounded-lg border border-neutral-200 px-2 py-2" /></label>
            <label className="text-sm">Bis <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block rounded-lg border border-neutral-200 px-2 py-2" /></label>
          </>
        ) : null}
        <select value={granularity} onChange={(event) => setGranularity(event.target.value)} className="rounded-lg border border-neutral-200 px-2 py-2">
          <option value="day">Tag</option>
          <option value="week">Woche</option>
          <option value="month">Monat</option>
        </select>
        <button type="button" onClick={() => void download()} className="rounded-lg bg-[#1C1F22] px-3 py-2 text-sm text-white">CSV exportieren</button>
      </div>
      {error ? <p className="text-sm text-[#C8102E]">{error}</p> : null}
      {current ? (
        <>
          <p className="text-sm text-neutral-500">{report?.timezone} · {report?.range.from} bis {report?.range.to}. Kassiert zählt nur den Status Bezahlt. Barzahlungen bleiben unbezahlt.</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card label="Umsatz" value={formatEuro(current.salesCents)} detail={`${current.salesCount} bewertete Bestellungen`} />
            <Card label="Kassiert" value={formatEuro(current.collectedCents)} detail={`${current.collectedCount} bezahlt`} />
            <Card label="Unbezahlt" value={formatEuro(current.unpaidCents)} detail={`${current.unpaidCount} offen`} />
            <Card label="Durchschnitt" value={formatEuro(current.averageOrderCents)} detail={`${current.orderCount} Bestellungen gesamt`} />
          </div>
          <Section title="Zeitraum">
            <table className="w-full text-left text-sm"><tbody>
              {report?.series.map((row) => <tr key={row.bucket} className="border-b border-neutral-100"><td className="py-2">{row.bucket}</td><td>{formatEuro(row.salesCents)}</td><td>Kassiert {formatEuro(row.collectedCents)}</td><td>Unbezahlt {formatEuro(row.unpaidCents)}</td><td>{row.salesCount}</td></tr>)}
            </tbody></table>
          </Section>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Lieferung und Abholung">
              <p className="text-sm">Lieferung: {report?.fulfillment.delivery.count} · {formatEuro(report?.fulfillment.delivery.salesCents ?? 0)}</p>
              <p className="mt-2 text-sm">Abholung: {report?.fulfillment.pickup.count} · {formatEuro(report?.fulfillment.pickup.salesCents ?? 0)}</p>
              <p className="mt-3 text-sm">Abgelehnt {report?.voids.rejected} · Storniert {report?.voids.cancelled}</p>
            </Section>
            <Section title="Lieferleistung">
              <p className="text-sm">Abgeschlossen {report?.deliveryPerformance.completed} · Abgelehnt {report?.deliveryPerformance.rejected} · Storniert {report?.deliveryPerformance.cancelled}</p>
              <p className="mt-2 text-sm">Liefergebühren {formatEuro(report?.deliveryPerformance.feeCents ?? 0)} · Ø {report?.deliveryPerformance.averageDistanceKm} km</p>
              <p className="mt-2 text-sm">Pünktlich {report?.deliveryPerformance.onTime ?? 0} von {report?.deliveryPerformance.measured ?? 0}{report?.deliveryPerformance.onTimeRatio == null ? "" : ` · ${Math.round(report.deliveryPerformance.onTimeRatio * 100)} %`} · zu spät {report?.deliveryPerformance.late ?? 0}</p>
              <p className="mt-1 text-sm">Ohne gespeicherte Zusage: {report?.deliveryPerformance.unmeasured ?? 0}</p>
              <p className="mt-2 text-xs text-neutral-500">{report?.deliveryPerformance.note}</p>
            </Section>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Produkte">
              {report?.topProducts.map((row) => <p key={`${row.sku}-${row.name}`} className="border-b border-neutral-100 py-2 text-sm">{row.sku} · {row.name} · {row.quantity} · {formatEuro(row.salesCents)}</p>)}
            </Section>
            <Section title="Kategorien">
              {report?.categories.map((row) => <p key={row.name} className="border-b border-neutral-100 py-2 text-sm">{row.name} · {formatEuro(row.salesCents)}</p>)}
            </Section>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Card({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"><p className="text-sm text-neutral-500">{label}</p><p className="mt-1 font-display text-3xl">{value}</p><p className="mt-1 text-xs text-neutral-500">{detail}</p></section>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"><h2 className="mb-3 font-display text-2xl">{title}</h2>{children}</section>;
}
