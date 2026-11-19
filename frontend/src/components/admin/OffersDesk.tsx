"use client";

import { api } from "@/lib/api";
import { useEffect, useState } from "react";

type Product = {
  id: string; sku: string; name: string; description: string; image: string | null; allergenCodes: string;
  available: boolean; isOffer: boolean; category: { id: string; name: string };
  variants: { id: string; label: string; detail: string; priceCents: number; includedExtraCount: number }[];
};
type Announcement = { slug?: string; title: string; body: string; active: boolean; phoneOnly: boolean; minimumOrderCents: number | null };

export function OffersDesk() {
  const [products, setProducts] = useState<Product[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<{ items: Product[] }>("/api/admin/products?isOffer=true&page=1&pageSize=50"),
      api<{ announcement: Announcement | null }>("/api/restaurant"),
    ]).then(([catalog, restaurant]) => {
      if (cancelled) return;
      setProducts(catalog.items);
      setAnnouncement(restaurant.announcement);
    }).catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Angebote konnten nicht geladen werden."); });
    return () => { cancelled = true; };
  }, [tick]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-2xl">Angebotsprodukte</h2>
        <p className="mt-2 text-sm text-neutral-500">Nur Produkte mit dem vorhandenen Angebotsfeld. Es gibt kein zweites Aktionssystem.</p>
        {error ? <p className="mt-3 text-sm text-[#C8102E]">{error}</p> : null}
        <div className="mt-4 space-y-2">
          {products.map((product) => (
            <div key={product.id} className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2 text-sm">
              <span>{product.sku} · {product.name}</span>
              <button type="button" className="underline" onClick={() => void api(`/api/admin/products/${product.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                  categoryId: product.category.id, sku: product.sku, name: product.name, description: product.description,
                  image: product.image, allergenCodes: product.allergenCodes, available: product.available, isOffer: false,
                  variants: product.variants.map((variant) => ({ id: variant.id, label: variant.label, detail: variant.detail, priceCents: variant.priceCents, includedExtraCount: variant.includedExtraCount })),
                }),
              }).then(() => setTick((value) => value + 1))}>Aus Angebot nehmen</button>
            </div>
          ))}
          {!products.length ? <p className="text-sm text-neutral-500">Keine Produkte sind als Angebot markiert.</p> : null}
        </div>
      </section>
      {announcement ? (
        <form className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          api("/api/admin/promotions/phone-gift", {
            method: "PATCH",
            body: JSON.stringify({
              title: String(form.get("title")),
              body: String(form.get("body")),
              active: form.get("active") === "on",
              phoneOnly: announcement.phoneOnly,
              minimumOrderCents: Math.round(Number(String(form.get("minimum")).replace(",", ".")) * 100),
            }),
          }).then(() => setTick((value) => value + 1)).catch((caught) => setError(caught instanceof Error ? caught.message : "Speichern fehlgeschlagen."));
        }}>
          <h2 className="font-display text-2xl">Ankündigung</h2>
          <input name="title" defaultValue={announcement.title} required className="rounded-lg border border-neutral-200 px-3 py-2" />
          <textarea name="body" defaultValue={announcement.body} required className="min-h-24 rounded-lg border border-neutral-200 px-3 py-2" />
          <input name="minimum" defaultValue={((announcement.minimumOrderCents ?? 0) / 100).toFixed(2)} className="rounded-lg border border-neutral-200 px-3 py-2" />
          <label className="text-sm"><input name="active" type="checkbox" defaultChecked={announcement.active} /> Ankündigung anzeigen</label>
          <button className="w-fit rounded-lg bg-[#1C1F22] px-3 py-2 text-sm text-white">Speichern</button>
        </form>
      ) : null}
    </div>
  );
}
