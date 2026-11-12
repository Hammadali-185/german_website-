import { loadSite } from "@/lib/catalog";

export const metadata = { title: "Über uns" };

export default async function AboutPage() {
  const site = await loadSite();
  const restaurant = site.restaurant;
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="text-xs uppercase tracking-[0.14em] text-brand sm:tracking-[0.22em]">{restaurant.yearsClaim}</p>
      <h1 className="mt-3 font-display text-4xl sm:text-6xl">Über Pizza Blitz</h1>
      <p className="mt-6 text-lg text-mute">
        {restaurant.tradeName} ist ein {restaurant.legalName} von {restaurant.ownerName}. Die Küche steht in der {restaurant.street}, {restaurant.postalCode} {restaurant.city}.
        Auf der Karte stehen die Gerichte, Preise und Liefergebiete, die auf pizzablitz.online veröffentlicht sind.
      </p>
      <p className="mt-4 text-mute">Eine längere Restaurantgeschichte ist auf der bisherigen Website nicht veröffentlicht und wird hier nicht ergänzt. Bewertungen werden nicht angezeigt, weil keine überprüfbaren Stimmen vorliegen.</p>
    </div>
  );
}
