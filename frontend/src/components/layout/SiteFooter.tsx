import { MapPin } from "lucide-react";
import Link from "next/link";
import { DAY_LABELS } from "@/lib/format";
import { googleDirectionsUrl } from "@/lib/maps";
import type { Restaurant } from "@/types/catalog";

export function SiteFooter({ restaurant }: { restaurant: Restaurant }) {
  return (
    <footer className="mt-8 border-t-4 border-brand bg-forest text-cream">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div>
          <p className="font-display text-3xl">Pizza Blitz</p>
          <p className="mt-3 text-sm text-cream/70">{restaurant.tradeName}</p>
          <a
            href={googleDirectionsUrl(restaurant.latitude, restaurant.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-start gap-2 text-sm text-cream/70 underline-offset-4 hover:text-white hover:underline"
          >
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
            <span>
              {restaurant.street}
              <br />
              {restaurant.postalCode} {restaurant.city}
            </span>
          </a>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cream/50">Kontakt</p>
          <a className="mt-3 block text-sm" href={`tel:${restaurant.phoneInternational}`}>
            {restaurant.phone}
          </a>
          <p className="mt-2 text-sm text-cream/70">Fax {restaurant.fax}</p>
          {restaurant.facebookUrl ? (
            <a className="mt-3 block text-sm underline" href={restaurant.facebookUrl}>
              Facebook
            </a>
          ) : null}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cream/50">Öffnungszeiten</p>
          <ul className="mt-3 space-y-1 text-sm text-cream/80">
            {restaurant.hours.map((hour) => (
              <li key={hour.day} className="flex justify-between gap-4">
                <span>{hour.label || DAY_LABELS[hour.day]}</span>
                <span>
                  {hour.opens}–{hour.closes}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cream/50">Informationen</p>
          <div className="mt-3 grid gap-2 text-sm">
            <Link className="py-1" href="/menu">Speisekarte</Link>
            <Link className="py-1" href="/delivery">Lieferung</Link>
            <Link className="py-1" href="/impressum">Impressum</Link>
            <Link className="py-1" href="/agb">AGB</Link>
            <Link className="py-1" href="/datenschutz">Datenschutz</Link>
            <Link className="py-1" href="/allergene">Allergene & Zusatzstoffe</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
