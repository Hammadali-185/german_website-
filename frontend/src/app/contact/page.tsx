import { ContactForm } from "@/components/contact/ContactForm";
import { loadSite } from "@/lib/catalog";

export const metadata = { title: "Kontakt" };

export default async function ContactPage() {
  const { restaurant } = await loadSite();
  const map = `https://www.openstreetmap.org/export/embed.html?bbox=${restaurant.longitude - 0.02}%2C${restaurant.latitude - 0.01}%2C${restaurant.longitude + 0.02}%2C${restaurant.latitude + 0.01}&layer=mapnik&marker=${restaurant.latitude}%2C${restaurant.longitude}`;
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2">
      <div>
        <h1 className="font-display text-4xl sm:text-6xl">Kontakt</h1>
        <p className="mt-4 text-lg">{restaurant.tradeName}</p>
        <p className="mt-2 text-mute">{restaurant.street}<br />{restaurant.postalCode} {restaurant.city}</p>
        <p className="mt-4"><a className="inline-flex min-h-11 items-center text-brand" href={`tel:${restaurant.phoneInternational}`}>{restaurant.phone}</a></p>
        <p className="text-mute">Fax {restaurant.fax}</p>
        <p className="mt-4 text-sm text-mute">Eine öffentliche E-Mail-Adresse steht im Impressum nicht. Nachrichten werden nur im Admin-Bereich gespeichert.</p>
        <div className="mt-6"><ContactForm /></div>
      </div>
      <iframe title="Karte von Pizza Blitz" src={map} className="h-80 w-full max-w-full border-0" />
    </div>
  );
}
