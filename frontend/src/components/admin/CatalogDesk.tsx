"use client";

import { api } from "@/lib/api";
import { formatEuro } from "@/lib/format";
import { useEffect, useState } from "react";

type Tab = "products" | "categories" | "variants" | "extras";
type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
type Variant = { id: string; label: string; detail: string; priceCents: number; includedExtraCount: number };
type Product = {
  id: string; sku: string; name: string; description: string; image: string | null; allergenCodes: string;
  available: boolean; isOffer: boolean; category: { id: string; name: string }; variants: Variant[];
};
type Category = { id: string; name: string; slug: string; _count: { products: number } };
type VariantRow = { id: string; label: string; priceCents: number; product: { id: string; name: string; sku: string } };
type Extra = { id: string; name: string; _count: { prices: number } };

const tabs: { id: Tab; label: string }[] = [
  { id: "products", label: "Produkte" },
  { id: "categories", label: "Kategorien" },
  { id: "variants", label: "Varianten" },
  { id: "extras", label: "Extras" },
];

export function CatalogDesk() {
  const [tab, setTab] = useState<Tab>("products");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`min-h-10 rounded-lg px-3 text-sm ${tab === item.id ? "bg-[#1C1F22] text-white" : "border border-neutral-200 bg-white"}`}>{item.label}</button>
        ))}
      </div>
      {tab === "products" ? <Products /> : null}
      {tab === "categories" ? <Categories /> : null}
      {tab === "variants" ? <Variants /> : null}
      {tab === "extras" ? <Extras /> : null}
    </div>
  );
}

function usePage<T>(path: string, q: string, page: number, extra = "") {
  const [data, setData] = useState<Page<T> | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (q.trim()) params.set("q", q.trim());
    let cancelled = false;
    api<Page<T>>(`${path}?${params.toString()}${extra}`)
      .then((next) => { if (!cancelled) setData(next); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Die Liste konnte nicht geladen werden."); });
    return () => { cancelled = true; };
  }, [path, q, page, extra, tick]);
  return { data, error, reload: () => setTick((value) => value + 1) };
}

function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-neutral-500">{total} Einträge</span>
      <div className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 disabled:opacity-40">Zurück</button>
        <span className="px-2 py-2">{page} / {pages}</span>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 disabled:opacity-40">Weiter</button>
      </div>
    </div>
  );
}

function Products() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, reload } = usePage<Product>("/api/admin/products", q, page);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Name oder Nummer" className="rounded-lg border border-neutral-200 px-3 py-2" />
        <button type="button" onClick={() => setEditing("new")} className="rounded-lg bg-[#C8102E] px-3 py-2 text-sm text-white">Produkt anlegen</button>
      </div>
      {error ? <p className="text-sm text-[#C8102E]">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-neutral-200 text-neutral-500"><tr><th className="p-3">Nr.</th><th>Name</th><th>Kategorie</th><th>Preis</th><th>Status</th></tr></thead>
          <tbody>
            {data?.items.map((product) => (
              <tr key={product.id} className="border-b border-neutral-100">
                <td className="p-3">{product.sku}</td>
                <td>{product.name}</td>
                <td>{product.category.name}</td>
                <td>{product.variants[0] ? formatEuro(product.variants[0].priceCents) : "—"}</td>
                <td>
                  <button type="button" className="underline" onClick={() => void saveProduct({ ...product, available: !product.available }).then(reload)}>{product.available ? "Verfügbar" : "Ausgeblendet"}</button>
                  <button type="button" className="ml-3 underline" onClick={() => setEditing(product)}>Bearbeiten</button>
                  <button type="button" className="ml-3 text-[#C8102E]" onClick={() => { if (window.confirm(`Produkt „${product.name}“ löschen? Bestehende Bestellungen bleiben erhalten.`)) void api(`/api/admin/products/${product.id}`, { method: "DELETE" }).then(reload); }}>Löschen</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={data?.total ?? 0} pageSize={data?.pageSize ?? 20} onPage={setPage} />
      {editing ? <ProductForm product={editing === "new" ? null : editing} onClose={() => { setEditing(null); reload(); }} /> : null}
    </div>
  );
}

function saveProduct(product: Product) {
  return api(`/api/admin/products/${product.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      categoryId: product.category.id, sku: product.sku, name: product.name, description: product.description,
      image: product.image, allergenCodes: product.allergenCodes, available: product.available, isOffer: product.isOffer,
      variants: product.variants.map((variant) => ({ id: variant.id, label: variant.label, detail: variant.detail, priceCents: variant.priceCents, includedExtraCount: variant.includedExtraCount })),
    }),
  });
}

function ProductForm({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState(product?.category.id ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [image, setImage] = useState(product?.image ?? "");
  const [available, setAvailable] = useState(product?.available ?? true);
  const [isOffer, setIsOffer] = useState(product?.isOffer ?? false);
  const [variants, setVariants] = useState(product?.variants.map((variant) => ({ ...variant, price: (variant.priceCents / 100).toFixed(2) })) ?? [{ id: "", label: "Preis", detail: "", price: "0.00", includedExtraCount: 0 }]);
  const [error, setError] = useState("");
  useEffect(() => { api<{ items: Category[] }>("/api/admin/categories?page=1&pageSize=50").then((page) => setCategories(page.items)).catch(() => undefined); }, []);
  return (
    <form className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm" onSubmit={(event) => {
      event.preventDefault();
      const body = {
        categoryId, sku, name, description, image: image.trim() || null, allergenCodes: product?.allergenCodes ?? "", available, isOffer,
        variants: variants.map((variant) => ({ id: variant.id || undefined, label: variant.label, detail: variant.detail, priceCents: Math.round(Number(variant.price.replace(",", ".")) * 100), includedExtraCount: variant.includedExtraCount })),
      };
      const request = product ? api(`/api/admin/products/${product.id}`, { method: "PATCH", body: JSON.stringify(body) }) : api("/api/admin/products", { method: "POST", body: JSON.stringify(body) });
      request.then(onClose).catch((caught) => setError(caught instanceof Error ? caught.message : "Speichern fehlgeschlagen."));
    }}>
      <h2 className="font-display text-2xl">{product ? "Produkt bearbeiten" : "Neues Produkt"}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" required className="rounded-lg border border-neutral-200 px-3 py-2" />
        <input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="Nummer" required className="rounded-lg border border-neutral-200 px-3 py-2" />
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required className="rounded-lg border border-neutral-200 px-3 py-2">
          <option value="">Kategorie</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <input value={image} onChange={(event) => setImage(event.target.value)} placeholder="Bildadresse https://" className="rounded-lg border border-neutral-200 px-3 py-2" />
      </div>
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Beschreibung" className="min-h-20 rounded-lg border border-neutral-200 px-3 py-2" />
      <label className="text-sm"><input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} /> Verfügbar</label>
      <label className="text-sm"><input type="checkbox" checked={isOffer} onChange={(event) => setIsOffer(event.target.checked)} /> Angebot</label>
      {variants.map((variant, index) => (
        <div key={variant.id || index} className="grid grid-cols-[1fr_8rem] gap-2">
          <input value={variant.label} onChange={(event) => setVariants((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, label: event.target.value } : entry))} placeholder="Größe" className="rounded-lg border border-neutral-200 px-3 py-2" />
          <input value={variant.price} onChange={(event) => setVariants((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, price: event.target.value } : entry))} className="rounded-lg border border-neutral-200 px-3 py-2" />
        </div>
      ))}
      <button type="button" className="w-fit text-sm underline" onClick={() => setVariants((current) => [...current, { id: "", label: "Größe", detail: "", price: "0.00", includedExtraCount: 0 }])}>Größe hinzufügen</button>
      {error ? <p className="text-sm text-[#C8102E]">{error}</p> : null}
      <div className="flex gap-2">
        <button className="rounded-lg bg-[#1C1F22] px-3 py-2 text-sm text-white">Speichern</button>
        <button type="button" onClick={onClose} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm">Abbrechen</button>
      </div>
    </form>
  );
}

function Categories() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const { data, reload } = usePage<Category>("/api/admin/categories", q, page);
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2" onSubmit={(event) => {
        event.preventDefault();
        const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `kategorie-${Date.now()}`;
        api("/api/admin/categories", { method: "POST", body: JSON.stringify({ name, slug }) }).then(() => { setName(""); reload(); }).catch((caught) => setError(caught instanceof Error ? caught.message : "Anlegen fehlgeschlagen."));
      }}>
        <input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Suche" className="rounded-lg border border-neutral-200 px-3 py-2" />
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Neue Kategorie" required className="rounded-lg border border-neutral-200 px-3 py-2" />
        <button className="rounded-lg bg-[#C8102E] px-3 py-2 text-sm text-white">Anlegen</button>
      </form>
      {error ? <p className="text-sm text-[#C8102E]">{error}</p> : null}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        {data?.items.map((category) => (
          <div key={category.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 text-sm last:border-0">
            <span>{category.name} <span className="text-neutral-500">· {category._count.products} Produkte</span></span>
            <span className="flex gap-3">
              <button type="button" className="underline" onClick={() => { const next = window.prompt("Name", category.name); if (next) void api(`/api/admin/categories/${category.id}`, { method: "PATCH", body: JSON.stringify({ name: next }) }).then(reload); }}>Umbenennen</button>
              <button type="button" className="text-[#C8102E]" onClick={() => { if (window.confirm("Kategorie löschen?")) void api(`/api/admin/categories/${category.id}`, { method: "DELETE" }).then(reload).catch((caught) => setError(caught instanceof Error ? caught.message : "Löschen fehlgeschlagen.")); }}>Löschen</button>
            </span>
          </div>
        ))}
      </div>
      <Pager page={page} total={data?.total ?? 0} pageSize={data?.pageSize ?? 20} onPage={setPage} />
    </div>
  );
}

function Variants() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, reload } = usePage<VariantRow>("/api/admin/variants", q, page);
  return (
    <div className="space-y-4">
      <input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Produkt oder Größe" className="rounded-lg border border-neutral-200 px-3 py-2" />
      {error ? <p className="text-sm text-[#C8102E]">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-neutral-200 text-neutral-500"><tr><th className="p-3">Produkt</th><th>Größe</th><th>Preis</th></tr></thead>
          <tbody>
            {data?.items.map((variant) => (
              <tr key={variant.id} className="border-b border-neutral-100">
                <td className="p-3">{variant.product.sku} · {variant.product.name}</td>
                <td>{variant.label}</td>
                <td>
                  <input className="w-24 rounded-md border border-neutral-200 px-2 py-1" defaultValue={(variant.priceCents / 100).toFixed(2)} onBlur={(event) => {
                    const priceCents = Math.round(Number(event.target.value.replace(",", ".")) * 100);
                    if (!Number.isFinite(priceCents)) return;
                    void api(`/api/admin/variants/${variant.id}`, { method: "PATCH", body: JSON.stringify({ priceCents }) }).then(reload);
                  }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={data?.total ?? 0} pageSize={data?.pageSize ?? 20} onPage={setPage} />
    </div>
  );
}

function Extras() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const { data, error, reload } = usePage<Extra>("/api/admin/extras", q, page);
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2" onSubmit={(event) => {
        event.preventDefault();
        void api("/api/admin/extras", { method: "POST", body: JSON.stringify({ name, sourceExtraId: `manual-${Date.now()}` }) }).then(() => { setName(""); reload(); });
      }}>
        <input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Extra suchen" className="rounded-lg border border-neutral-200 px-3 py-2" />
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Neues Extra" required className="rounded-lg border border-neutral-200 px-3 py-2" />
        <button className="rounded-lg bg-[#C8102E] px-3 py-2 text-sm text-white">Anlegen</button>
      </form>
      {error ? <p className="text-sm text-[#C8102E]">{error}</p> : null}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        {data?.items.map((extra) => (
          <div key={extra.id} className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 text-sm last:border-0">
            <span>{extra.name}</span>
            <span className="flex items-center gap-3">
              <span className="text-neutral-500">{extra._count.prices} Verknüpfungen</span>
              <button type="button" className="underline" onClick={() => { const next = window.prompt("Name", extra.name); if (next) void api(`/api/admin/extras/${extra.id}`, { method: "PATCH", body: JSON.stringify({ name: next }) }).then(reload); }}>Umbenennen</button>
            </span>
          </div>
        ))}
      </div>
      <Pager page={page} total={data?.total ?? 0} pageSize={data?.pageSize ?? 20} onPage={setPage} />
    </div>
  );
}
