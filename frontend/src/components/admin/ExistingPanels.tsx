"use client";

import { api } from "@/lib/api";

type Area = { id: string; postalCode: string; locality: string; minimumOrderCents: number; deliveryFeeCents: number | null; active: boolean };
type Hour = { id: string; label: string; opens: string; closes: string };
type Promotion = { slug: string; title: string; body: string; active: boolean; phoneOnly: boolean; minimumOrderCents: number | null };

export function SettingsPanel({
  hours,
  areas,
  promotion,
  holidayMode,
  pickupMinimum,
  preparationMinutes,
  deliveryMinutesPerKm,
  onHoliday,
  onPickup,
  onPreparation,
  onTravel,
  onSaveRestaurant,
}: {
  hours: Hour[];
  areas: Area[];
  promotion: Promotion | null;
  holidayMode: boolean;
  pickupMinimum: number;
  preparationMinutes: number | null;
  deliveryMinutesPerKm: number | null;
  onHoliday: (value: boolean) => void;
  onPickup: (value: number) => void;
  onPreparation: (value: number | null) => void;
  onTravel: (value: number | null) => void;
  onSaveRestaurant: () => void;
}) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-3xl">Zeiten</h2>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={holidayMode} onChange={(event) => onHoliday(event.target.checked)} />
          Feiertagszeiten heute verwenden
        </label>
        <label className="mt-3 block text-sm">
          Mindestbestellwert Abholung in Cent
          <input className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2" value={pickupMinimum} onChange={(event) => onPickup(Number(event.target.value))} />
        </label>
        <label className="mt-3 block text-sm">
          Zubereitung in Minuten
          <input className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2" value={preparationMinutes ?? ""} onChange={(event) => onPreparation(event.target.value === "" ? null : Number(event.target.value))} />
        </label>
        <label className="mt-3 block text-sm">
          Zusätzliche Minuten je Kilometer
          <input className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2" value={deliveryMinutesPerKm ?? ""} onChange={(event) => onTravel(event.target.value === "" ? null : Number(event.target.value))} />
        </label>
        <p className="mt-2 text-xs text-neutral-500">Leer lassen, wenn noch keine Lieferzusage gespeichert werden soll. Bestehende Bestellungen behalten ihre alte Zusage.</p>
        <button type="button" className="mt-3 rounded-lg bg-[#1C1F22] px-3 py-2 text-sm text-white" onClick={onSaveRestaurant}>Speichern</button>
        <div className="mt-4 grid gap-2">
          {hours.map((hour) => (
            <form
              key={hour.id}
              className="grid grid-cols-2 items-center gap-2 border-b border-neutral-100 pb-3 text-sm last:border-0 sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_auto] sm:border-0 sm:pb-0"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void api(`/api/admin/hours/${hour.id}`, { method: "PATCH", body: JSON.stringify({ opens: data.get("opens"), closes: data.get("closes") }) });
              }}
            >
              <span className="col-span-2 sm:col-span-1">{hour.label}</span>
              <input name="opens" defaultValue={hour.opens} className="rounded-md border border-neutral-200 px-2 py-1" />
              <input name="closes" defaultValue={hour.closes} className="rounded-md border border-neutral-200 px-2 py-1" />
              <button className="underline">OK</button>
            </form>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-3xl">Liefergebiete</h2>
        <div className="mt-3 max-h-96 space-y-2 overflow-y-auto text-sm">
          {areas.map((area) => (
            <form
              key={area.id}
              className="grid grid-cols-2 gap-2 border-b border-neutral-100 pb-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_5rem_5rem_auto] sm:items-center sm:border-0 sm:pb-0"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void api(`/api/admin/areas/${area.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({
                    minimumOrderCents: Math.round(Number(data.get("minimum")) * 100),
                    deliveryFeeCents: data.get("fee") === "" ? null : Math.round(Number(data.get("fee")) * 100),
                    active: true,
                  }),
                });
              }}
            >
              <span className="col-span-2 sm:col-span-1">{area.postalCode} {area.locality}</span>
              <input name="minimum" defaultValue={(area.minimumOrderCents / 100).toFixed(2)} className="rounded-md border border-neutral-200 px-2 py-1" />
              <input name="fee" placeholder="Gebühr" defaultValue={area.deliveryFeeCents == null ? "" : (area.deliveryFeeCents / 100).toFixed(2)} className="rounded-md border border-neutral-200 px-2 py-1" />
              <button className="underline">OK</button>
            </form>
          ))}
        </div>
      </section>
      {promotion ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="font-display text-3xl">Hinweis</h2>
          <form
            className="mt-3 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void api(`/api/admin/promotions/${promotion.slug ?? "phone-gift"}`, {
                method: "PATCH",
                body: JSON.stringify({
                  title: data.get("title"),
                  body: data.get("body"),
                  active: data.get("active") === "on",
                  phoneOnly: true,
                  minimumOrderCents: Math.round(Number(data.get("minimum")) * 100),
                }),
              });
            }}
          >
            <input name="title" defaultValue={promotion.title} className="rounded-lg border border-neutral-200 px-3 py-2" />
            <textarea name="body" defaultValue={promotion.body} className="min-h-24 rounded-lg border border-neutral-200 px-3 py-2" />
            <input name="minimum" defaultValue={((promotion.minimumOrderCents ?? 0) / 100).toFixed(2)} className="rounded-lg border border-neutral-200 px-3 py-2" />
            <label className="text-sm"><input type="checkbox" name="active" defaultChecked={promotion.active} /> Anzeigen</label>
            <button className="w-fit rounded-lg bg-[#1C1F22] px-3 py-2 text-sm text-white">Speichern</button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
