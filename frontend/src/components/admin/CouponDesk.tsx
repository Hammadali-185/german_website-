"use client";

import { api } from "@/lib/api";
import { formatEuro } from "@/lib/format";
import { orderCode } from "@pizzablitz/shared";
import { useEffect, useState } from "react";

type Coupon = {
  id: string; code: string; type: "PERCENT" | "FIXED"; percentOff: number | null; amountOffCents: number | null;
  minimumSubtotalCents: number; startsAt: string | null; endsAt: string | null; active: boolean;
  maxRedemptions: number | null; perCustomerLimit: number | null; _count: { redemptions: number };
};
type Redemption = { id: string; discountCents: number; createdAt: string; order: { publicNumber: number; status: string; totalCents: number; customerPhone: string } };

export function CouponDesk() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Coupon[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<Redemption[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (q.trim()) params.set("q", q.trim());
    let cancelled = false;
    api<{ items: Coupon[]; total: number; pageSize: number }>(`/api/admin/coupons?${params}`)
      .then((next) => { if (!cancelled) setData(next); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Gutscheine konnten nicht geladen werden."); });
    return () => { cancelled = true; };
  }, [q, page, tick]);

  useEffect(() => {
    if (!selected) { setHistory([]); return; }
    let cancelled = false;
    api<{ items: Redemption[] }>(`/api/admin/coupons/${selected}/redemptions?page=1&pageSize=20`)
      .then((next) => { if (!cancelled) setHistory(next.items); })
      .catch(() => { if (!cancelled) setHistory([]); });
    return () => { cancelled = true; };
  }, [selected, tick]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <form className="grid gap-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm md:grid-cols-4" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const type = String(form.get("type"));
          const body = {
            code: String(form.get("code")),
            type,
            percentOff: type === "PERCENT" ? Number(form.get("percent")) : null,
            amountOffCents: type === "FIXED" ? Math.round(Number(String(form.get("amount")).replace(",", ".")) * 100) : null,
            minimumSubtotalCents: Math.round(Number(String(form.get("minimum") || "0").replace(",", ".")) * 100),
            startsAt: form.get("starts") ? new Date(String(form.get("starts"))).toISOString() : null,
            endsAt: form.get("ends") ? new Date(String(form.get("ends"))).toISOString() : null,
            active: form.get("active") === "on",
            maxRedemptions: form.get("max") ? Number(form.get("max")) : null,
            perCustomerLimit: form.get("each") ? Number(form.get("each")) : null,
          };
          api("/api/admin/coupons", { method: "POST", body: JSON.stringify(body) })
            .then(() => { event.currentTarget.reset(); setTick((value) => value + 1); })
            .catch((caught) => setError(caught instanceof Error ? caught.message : "Anlegen fehlgeschlagen."));
        }}>
          <input name="code" required placeholder="Code" className="rounded-lg border border-neutral-200 px-3 py-2" />
          <select name="type" className="rounded-lg border border-neutral-200 px-2 py-2"><option value="PERCENT">Prozent</option><option value="FIXED">Festbetrag</option></select>
          <input name="percent" placeholder="Prozent" className="rounded-lg border border-neutral-200 px-3 py-2" />
          <input name="amount" placeholder="Betrag EUR" className="rounded-lg border border-neutral-200 px-3 py-2" />
          <input name="minimum" placeholder="Mindestwert EUR" className="rounded-lg border border-neutral-200 px-3 py-2" />
          <input name="starts" type="datetime-local" className="rounded-lg border border-neutral-200 px-2 py-2" />
          <input name="ends" type="datetime-local" className="rounded-lg border border-neutral-200 px-2 py-2" />
          <input name="max" placeholder="Max. Einlösungen" className="rounded-lg border border-neutral-200 px-3 py-2" />
          <input name="each" placeholder="Limit je Kunde" className="rounded-lg border border-neutral-200 px-3 py-2" />
          <label className="text-sm"><input name="active" type="checkbox" defaultChecked /> Aktiv</label>
          <button className="rounded-lg bg-[#C8102E] px-3 py-2 text-sm text-white">Anlegen</button>
        </form>
        {error ? <p className="text-sm text-[#C8102E]">{error}</p> : null}
        <input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Code suchen" className="rounded-lg border border-neutral-200 px-3 py-2" />
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          {data?.items.map((coupon) => (
            <button key={coupon.id} type="button" onClick={() => setSelected(coupon.id)} className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3 text-left text-sm last:border-0">
              <span>{coupon.code} · {coupon.type === "PERCENT" ? `${coupon.percentOff} %` : formatEuro(coupon.amountOffCents ?? 0)} · Mindest {formatEuro(coupon.minimumSubtotalCents)}</span>
              <span className="text-neutral-500">{coupon.active ? "Aktiv" : "Inaktiv"} · {coupon._count.redemptions} Einlösungen</span>
            </button>
          ))}
          {data && !data.items.length ? <p className="p-4 text-sm text-neutral-500">Keine Gutscheine.</p> : null}
        </div>
      </div>
      <aside className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-2xl">Einlösungen</h2>
        {history.map((entry) => (
          <p key={entry.id} className="mt-3 border-b border-neutral-100 pb-2 text-sm">{orderCode(entry.order.publicNumber)} · {formatEuro(entry.discountCents)} · {entry.order.status}<br />{entry.order.customerPhone}</p>
        ))}
        {!selected ? <p className="mt-3 text-sm text-neutral-500">Gutschein auswählen.</p> : null}
      </aside>
    </div>
  );
}
