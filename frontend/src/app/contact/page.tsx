import { MapPin } from "lucide-react";
import { ContactForm } from "@/components/contact/ContactForm";
import { LocationMap } from "@/components/location/LocationMap";
import { loadSite } from "@/lib/catalog";
import { googleDirectionsUrl } from "@/lib/maps";

export const metadata = { title: "Kontakt" };

export default async function ContactPage() {
  const { restaurant } = await loadSite();
  const directions = googleDirectionsUrl(restaurant.latitude, restaurant.longitude);
  const address = `${restaurant.street}, ${restaurant.postalCode} ${restaurant.city}`;
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:items-start">
      <div>
        <h1 className="font-display text-4xl sm:text-6xl">Kontakt</h1>
        <p className="mt-4 text-lg">{restaurant.tradeName}</p>
        <a href={directions} target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-11 items-start gap-2 text-ink underline-offset-4 hover:underline">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
          <span>
            {restaurant.street}
            <br />
            {restaurant.postalCode} {restaurant.city}
          </span>
        </a>
        <a href={directions} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white shadow-card">
          Route planen
        </a>
        <p className="mt-4"><a className="inline-flex min-h-11 items-center text-brand" href={`tel:${restaurant.phoneInternational}`}>{restaurant.phone}</a></p>
        <p className="text-mute">Fax {restaurant.fax}</p>
        <p className="mt-4 text-sm text-mute">Eine öffentliche E-Mail-Adresse steht im Impressum nicht. Nachrichten werden nur im Admin-Bereich gespeichert.</p>
        <div className="mt-6"><ContactForm /></div>
      </div>
      <LocationMap latitude={restaurant.latitude} longitude={restaurant.longitude} label={address} />
    </div>
  );
}
