"use client";

import { CartPanel } from "@/components/cart/CartPanel";
import { ProductDialog } from "@/components/products/ProductDialog";
import { formatEuro } from "@/lib/format";
import { useCart } from "@/store/cart";
import type { Category, Product } from "@/types/catalog";
import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export function MenuExperience({
  products,
  categories,
  initialCategory,
}: {
  products: Product[];
  categories: Category[];
  initialCategory?: string;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(initialCategory ?? "");
  const [selected, setSelected] = useState<Product | null>(null);
  const add = useCart((state) => state.add);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      const categoryMatch = !active || product.category.slug === active;
      const text = `${product.name} ${product.description} ${product.sku}`.toLowerCase();
      return categoryMatch && (!needle || text.includes(needle));
    });
  }, [active, products, query]);

  function quickAdd(product: Product) {
    const variant = product.variants[0];
    if (!variant || product.customizable) {
      setSelected(product);
      return;
    }
    add({
      productId: product.id,
      variantId: variant.id,
      sku: product.sku,
      name: product.name,
      variantLabel: variant.label,
      basePriceCents: variant.priceCents,
      includedExtraCount: variant.includedExtraCount,
      choices: [],
      extras: [],
      orderingEnabled: product.orderingEnabled,
    });
  }

  return (
    <div className="mx-auto grid min-w-0 max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
      <aside className="min-w-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:snap-none lg:gap-1 lg:overflow-visible lg:px-0">
          <Link href="/menu" onClick={() => setActive("")} className={`inline-flex min-h-11 shrink-0 snap-start items-center rounded-full px-4 text-sm ${active === "" ? "bg-forest text-cream" : "bg-white shadow-sm"}`}>
            Alle
          </Link>
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/menu/${category.slug}`}
              onClick={() => setActive(category.slug)}
              className={`inline-flex min-h-11 shrink-0 snap-start items-center rounded-full px-4 text-sm ${active === category.slug ? "bg-forest text-cream" : "bg-white shadow-sm"}`}
            >
              {category.name}
            </Link>
          ))}
        </div>
      </aside>
      <section className="min-w-0">
        <div className="mb-5 flex items-center gap-3 rounded-full border border-ink/10 bg-white px-4 shadow-sm">
          <Search className="h-4 w-4 text-mute" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Gericht oder Nummer suchen" className="h-12 min-w-0 w-full bg-transparent text-base outline-none" />
        </div>
        {filtered.length === 0 ? <p className="bg-white p-8 text-mute">Keine Gerichte für diese Auswahl.</p> : null}
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          {filtered.map((product) => (
            <article key={product.id} className="rise-in group flex min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-card transition duration-300 active:scale-[0.99] hover:-translate-y-1 sm:rounded-3xl">
              <button type="button" onClick={() => setSelected(product)} className="flex w-full min-w-0 text-left sm:block">
                {product.image ? (
                  <img src={product.image} alt="" className="h-24 w-28 shrink-0 object-cover transition duration-700 group-hover:scale-105 sm:h-40 sm:w-full" />
                ) : (
                  <div className="h-24 w-28 shrink-0 bg-forest/5 sm:h-40 sm:w-full" />
                )}
                <div className="min-w-0 p-3 sm:p-4">
                  <p className="text-xs text-mute">Nr. {product.sku}</p>
                  <h2 className="mt-1 font-display text-lg leading-tight sm:text-2xl">{product.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-mute">{product.description}</p>
                </div>
              </button>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 px-3 pb-3 sm:px-4 sm:pb-4">
                <p className="font-medium">ab {formatEuro(product.fromPriceCents)}</p>
                <button type="button" onClick={() => quickAdd(product)} disabled={!product.available} className="min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-deep disabled:opacity-40">
                  {product.customizable ? "Auswählen" : "Hinzufügen"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <aside className="sticky top-24 hidden h-[calc(100vh-7rem)] overflow-hidden rounded-3xl shadow-card lg:block">
        <CartPanel />
      </aside>
      {selected ? <ProductDialog product={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
