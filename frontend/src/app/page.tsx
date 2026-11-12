import { DeliveryChecker } from "@/components/delivery/DeliveryChecker";
import { HomeHero } from "@/components/home/HomeHero";
import { Reveal } from "@/components/motion/Reveal";
import { loadAreas, loadSite } from "@/lib/catalog";
import { formatEuro } from "@/lib/format";
import Link from "next/link";

export default async function HomePage() {
  const [site, areas] = await Promise.all([loadSite(), loadAreas()]);
  const showcaseSlugs = ["pizzen", "burger-und-fast-food", "pasta", "Salate", "indisches", "dessert"];
  const showcase = showcaseSlugs
    .map((slug) => site.products.find((product) => product.category.slug === slug && product.available))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));
  const offers = site.products.filter((product) => product.isOffer);

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[100svh] overflow-hidden">
        <img src="/images/original/pizzen.jpg" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-paper/35 via-paper/80 to-paper" />
      </div>
      <div className="relative">
      <HomeHero open={site.restaurant.open} />
      {site.restaurant.announcement?.active ? (
        <section className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">
          <div className="rounded-2xl bg-forest px-4 py-4 text-white shadow-card sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Telefon</p>
            <p className="mt-2 text-sm font-medium leading-6 sm:text-base">{site.restaurant.announcement.body}</p>
          </div>
        </section>
      ) : null}

      <Reveal className="mx-auto mt-12 min-w-0 max-w-7xl px-4 sm:px-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="font-display text-4xl">Kategorien</h2>
          <Link href="/menu" className="shrink-0 py-2 text-sm text-brand">Alle ansehen</Link>
        </div>
        <div className="-mx-4 flex min-w-0 snap-x gap-3 overflow-x-auto px-4 pb-4">
          {site.categories.map((category) => (
            <Link key={category.slug} href={`/menu/${category.slug}`} className="rise-in group relative h-40 w-36 shrink-0 snap-start overflow-hidden rounded-2xl bg-forest shadow-card sm:h-56 sm:w-48 sm:rounded-3xl">
              {category.image ? (
                <img
                  src={category.image}
                  alt=""
                  className={`h-full w-full transition duration-700 group-hover:scale-110 ${category.slug === "angebot" ? "object-contain" : "object-cover"}`}
                />
              ) : null}
              <span className="absolute inset-0 bg-gradient-to-t from-forest via-forest/20 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 p-3 font-display text-base leading-tight text-cream [overflow-wrap:normal] sm:p-4 sm:text-xl">{category.name}</span>
            </Link>
          ))}
        </div>
      </Reveal>

      <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.2em] text-brand">Karte</p>
          <h2 className="mt-2 font-display text-4xl">Aus der Speisekarte</h2>
          <p className="mt-2 max-w-xl text-sm text-mute">Eine Auswahl echter Gerichte aus den Kategorien. Die Website veröffentlicht keine Bestseller-Rangliste.</p>
        </Reveal>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {showcase.map((product, index) => (
            <Reveal key={product.id} delay={index * 0.06}>
              <Link href={`/menu/${product.category.slug}`} className="group block overflow-hidden rounded-2xl bg-white shadow-card transition duration-300 active:scale-[0.99] hover:-translate-y-1 sm:rounded-3xl">
                {product.image ? <img src={product.image} alt="" className="h-32 w-full object-cover transition duration-700 group-hover:scale-105 sm:h-44" /> : null}
                <div className="p-4 sm:p-5">
                  <p className="text-xs text-mute">Nr. {product.sku}</p>
                  <h3 className="mt-1 font-display text-2xl leading-none sm:text-3xl">{product.name}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-mute">{product.description}</p>
                  <p className="mt-4 font-medium text-brand">ab {formatEuro(product.fromPriceCents)}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.2em] text-brand">Kombi</p>
          <h2 className="mt-2 font-display text-4xl">Angebote</h2>
        </Reveal>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {offers.map((offer, index) => (
            <Reveal key={offer.id} delay={index * 0.05}>
              <article className="flex h-full flex-col overflow-hidden rounded-2xl bg-forest text-cream shadow-card sm:rounded-3xl">
                <img src={offer.image ?? "/images/original/angebot.jpg"} alt="" className="h-24 w-full bg-brand-deep object-cover sm:h-36" />
                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <h3 className="font-display text-2xl sm:text-3xl">{offer.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-cream/75">{offer.description}</p>
                  <p className="mt-4 font-display text-3xl text-white">{formatEuro(offer.fromPriceCents)}</p>
                  <Link href="/offers" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-4 text-center text-sm font-semibold text-white transition hover:bg-brand-deep">Bestellen</Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <div className="grid gap-8 rounded-[2rem] bg-forest px-5 py-8 text-cream sm:px-8 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-brand">{site.restaurant.yearsClaim}</p>
            <h2 className="mt-3 font-display text-4xl sm:text-5xl">Toni&apos;s Pizzablitz Östringen</h2>
            <p className="mt-4 text-cream/75">
              {site.restaurant.legalName}, Inhaber {site.restaurant.ownerName}. {site.restaurant.street}, {site.restaurant.postalCode} {site.restaurant.city}. Telefon {site.restaurant.phone}.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 p-4 sm:p-5"><p className="text-xs text-cream/60">Gerichte</p><p className="font-display text-3xl leading-none sm:text-4xl">{site.products.length}</p></div>
            <div className="rounded-2xl bg-white/10 p-4 sm:p-5"><p className="text-xs text-cream/60">Kategorien</p><p className="font-display text-3xl leading-none sm:text-4xl">{site.categories.length}</p></div>
            <div className="rounded-2xl bg-white/10 p-4 sm:p-5"><p className="text-xs text-cream/60">Liefergebiete</p><p className="font-display text-3xl leading-none sm:text-4xl">{areas.length}</p></div>
            <div className="rounded-2xl bg-white/10 p-4 sm:p-5"><p className="text-xs text-cream/60">Abholung</p><p className="font-display text-2xl leading-none sm:text-3xl">Östringen</p></div>
          </div>
        </div>
      </Reveal>

      <section className="mx-auto mt-16 grid max-w-7xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-4xl">Liefern oder abholen</h2>
          <p className="mt-3 text-mute">Die Prüfung nutzt die 51 veröffentlichten Orte und ihre Mindestbestellwerte. Eine Liefergebühr wird nur berechnet, wenn sie hinterlegt ist.</p>
        </div>
        <DeliveryChecker areas={areas} />
      </section>
      </div>
    </div>
  );
}
