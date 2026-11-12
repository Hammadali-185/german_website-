import { DeliveryChecker } from "@/components/delivery/DeliveryChecker";
import { loadAreas, loadSite } from "@/lib/catalog";

export const metadata = { title: "Lieferung" };

export default async function DeliveryPage() {
  const [{ restaurant }, areas] = await Promise.all([loadSite(), loadAreas()]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl sm:text-6xl">Lieferung</h1>
      <p className="mt-4 max-w-2xl text-mute">Abholung in der {restaurant.street}. Lieferung nur in die veröffentlichten Gebiete. Der Mindestbestellwert hängt vom Ort ab. Eine Liefergebühr ist auf der alten Website nicht angegeben und bleibt leer, bis sie im Admin gesetzt wird.</p>
      <div className="mt-8 max-w-xl"><DeliveryChecker areas={areas} /></div>
      <ul className="mt-8 grid gap-2 sm:grid-cols-2">
        {areas.map((area) => (
          <li key={area.id} className="bg-white px-3 py-2 text-sm">{area.postalCode} {area.locality}</li>
        ))}
      </ul>
    </div>
  );
}
