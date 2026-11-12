import { loadSite } from "@/lib/catalog";
import { formatEuro } from "@/lib/format";
import Link from "next/link";

export const metadata = { title: "Angebote" };

export default async function OffersPage() {
  const site = await loadSite();
  const offers = site.products.filter((product) => product.isOffer);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl sm:text-6xl">Angebote</h1>
      <p className="mt-3 max-w-2xl text-mute">Das sind die neun festen Kombi-Angebote der Karte. Die Seite „Special“ des alten Shops meldet derzeit keine zusätzlichen Aktionen.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {offers.map((offer) => (
          <article key={offer.id} className="bg-white p-5">
            <p className="text-xs text-mute">Nr. {offer.sku}</p>
            <h2 className="font-display text-4xl">{offer.name}</h2>
            <p className="mt-2 text-sm text-mute">{offer.description}</p>
            <p className="mt-4 font-display text-3xl">{formatEuro(offer.fromPriceCents)}</p>
            <Link href="/menu/angebot" className="mt-4 inline-flex min-h-11 items-center bg-brand px-4 text-sm font-semibold text-white">Zusammenstellen</Link>
          </article>
        ))}
      </div>
    </div>
  );
}
