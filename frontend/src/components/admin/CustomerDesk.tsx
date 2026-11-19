"use client";

import { api } from "@/lib/api";
import { formatEuro } from "@/lib/format";
import { statusLabel } from "@pizzablitz/shared";
import { useEffect, useState } from "react";

type Customer = {
  key: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  orderCount: number;
  spendingCents: number;
  latestAt: string;
  latestOrderCode: string;
  account: { id: string; email: string | null; firstName: string | null; lastName: string | null } | null;
};
type HistoryOrder = { id: string; orderCode: string; status: string; fulfillment: string; totalCents: number; createdAt: string };
type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

export function CustomerDesk() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("latest");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<Customer> | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [history, setHistory] = useState<Page<HistoryOrder> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ sort, page: String(page), pageSize: "20" });
    if (q.trim()) params.set("q", q.trim());
    let cancelled = false;
    api<Page<Customer>>(`/api/admin/customers?${params.toString()}`)
      .then((next) => { if (!cancelled) setData(next); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Kunden konnten nicht geladen werden."); });
    return () => { cancelled = true; };
  }, [q, sort, page]);

  useEffect(() => {
    if (!selected) { setHistory(null); return; }
    let cancelled = false;
    api<Page<HistoryOrder>>(`/api/admin/customers/${encodeURIComponent(selected.key)}/orders?page=1&pageSize=20`)
      .then((next) => { if (!cancelled) setHistory(next); })
      .catch(() => { if (!cancelled) setHistory(null); });
    return () => { cancelled = true; };
  }, [selected]);

  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20)));
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Name, Telefon, E-Mail" className="rounded-lg border border-neutral-200 px-3 py-2" />
          <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} className="rounded-lg border border-neutral-200 px-2 py-2">
            <option value="latest">Letzte Bestellung</option>
            <option value="oldest">Älteste Aktivität</option>
            <option value="spending">Ausgaben</option>
            <option value="orders">Anzahl</option>
            <option value="name">Name</option>
          </select>
        </div>
        {error ? <p className="text-sm text-[#C8102E]">{error}</p> : null}
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500"><tr><th className="p-3">Kunde</th><th>Telefon</th><th>E-Mail</th><th>Bestellungen</th><th>Ausgaben</th><th>Zuletzt</th></tr></thead>
            <tbody>
              {data?.items.map((customer) => (
                <tr key={customer.key} onClick={() => setSelected(customer)} className="cursor-pointer border-b border-neutral-100">
                  <td className="p-3">{customer.firstName} {customer.lastName}{customer.account ? <span className="ml-2 text-xs text-neutral-500">Konto</span> : <span className="ml-2 text-xs text-neutral-400">Gast</span>}</td>
                  <td>{customer.phone || "—"}</td>
                  <td>{customer.email || "—"}</td>
                  <td>{customer.orderCount}</td>
                  <td>{formatEuro(customer.spendingCents)}</td>
                  <td>{customer.latestOrderCode}<br /><span className="text-neutral-500">{new Date(customer.latestAt).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && !data.items.length ? <p className="p-6 text-sm text-neutral-500">Keine Kunden für diese Auswahl.</p> : null}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-500">{data?.total ?? 0} Kunden</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 disabled:opacity-40">Zurück</button>
            <span className="px-2 py-2">{page} / {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 disabled:opacity-40">Weiter</button>
          </div>
        </div>
      </div>
      <aside className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        {selected ? (
          <>
            <h2 className="font-display text-2xl">{selected.firstName} {selected.lastName}</h2>
            <p className="text-sm text-neutral-500">{selected.phone || "Keine Telefonnummer"}{selected.email ? ` · ${selected.email}` : ""}</p>
            {selected.account ? <p className="mt-2 text-sm">Kundenkonto: {selected.account.email}</p> : <p className="mt-2 text-sm text-neutral-500">Gast ohne Kundenkonto</p>}
            <p className="mt-2 text-sm">{selected.orderCount} Bestellungen · {formatEuro(selected.spendingCents)} ohne Abgelehnte und Stornierte</p>
            <ul className="mt-4 space-y-2 text-sm">
              {history?.items.map((order) => (
                <li key={order.id} className="border-b border-neutral-100 pb-2">{order.orderCode} · {statusLabel(order.status, order.fulfillment)} · {formatEuro(order.totalCents)}</li>
              ))}
            </ul>
          </>
        ) : <p className="text-sm text-neutral-500">Kunde auswählen, um die Bestellhistorie zu sehen.</p>}
      </aside>
    </div>
  );
}
