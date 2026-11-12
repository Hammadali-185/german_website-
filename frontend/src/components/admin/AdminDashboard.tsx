"use client";

import { api } from "@/lib/api";
import { formatEuro } from "@/lib/format";
import { useEffect, useState } from "react";

type Stats = { totalOrders: number; pendingOrders: number; completedOrders: number; dailySalesCents: number; recent: { id: string; publicNumber: number; status: string; totalCents: number; customerFirstName: string; customerLastName: string }[] };
type Order = {
  id: string;
  publicNumber: number;
  status: string;
  fulfillment: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail: string;
  street: string;
  postalCode: string;
  city: string;
  notes: string;
  totalCents: number;
  deliveryFeeCents: number;
  items: { id: string; quantity: number; productName: string; variantLabel: string; lineTotalCents: number; customizationJson: { choices?: { label: string }[]; extras?: { name: string; included?: boolean }[] } }[];
  deliveryArea?: { locality: string } | null;
  payment?: { method: string; status: string } | null;
};
type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  allergenCodes: string;
  available: boolean;
  isOffer: boolean;
  category: { id: string; name: string };
  variants: { id: string; label: string; priceCents: number; detail: string; includedExtraCount: number }[];
};
type Area = { id: string; postalCode: string; locality: string; minimumOrderCents: number; deliveryFeeCents: number | null; active: boolean };
type Hour = { id: string; label: string; opens: string; closes: string };
type Promotion = { slug: string; title: string; body: string; active: boolean; phoneOnly: boolean; minimumOrderCents: number | null };

const statuses = ["PENDING", "ACCEPTED", "REJECTED", "PREPARING", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "COMPLETED", "CANCELLED"];

export function AdminDashboard() {
  const [tab, setTab] = useState("dashboard");
  const [error, setError] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [hours, setHours] = useState<Hour[]>([]);
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [holidayMode, setHolidayMode] = useState(false);
  const [pickupMinimum, setPickupMinimum] = useState(0);

  async function load() {
    setError("");
    try {
      const [nextStats, nextOrders, nextProducts, restaurant, nextAreas] = await Promise.all([
        api<Stats>("/api/admin/stats"),
        api<Order[]>("/api/admin/orders"),
        api<Product[]>("/api/admin/products"),
        api<{ holidayMode: boolean; pickupMinimumCents: number; hours: Hour[]; announcement: Promotion | null }>("/api/restaurant"),
        api<Area[]>("/api/delivery/areas"),
      ]);
      setStats(nextStats);
      setOrders(nextOrders);
      setProducts(nextProducts);
      setHours(restaurant.hours);
      setPromotion(restaurant.announcement);
      setHolidayMode(restaurant.holidayMode);
      setPickupMinimum(restaurant.pickupMinimumCents);
      setAreas(nextAreas);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Admin-Daten konnten nicht geladen werden.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function updateStatus(id: string, status: string) {
    await api(`/api/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await load();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-4xl sm:text-5xl">Restaurant</h1>
      {error ? <p className="mt-4 bg-white p-4 text-sm text-brand">{error}</p> : null}
      <div className="mt-6 flex gap-2 overflow-x-auto">
        {[
          ["dashboard", "Übersicht"],
          ["orders", "Bestellungen"],
          ["menu", "Speisekarte"],
          ["settings", "Einstellungen"],
        ].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`min-h-11 shrink-0 px-4 text-sm ${tab === id ? "bg-ink text-cream" : "bg-white"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && stats ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          {[
            ["Bestellungen", String(stats.totalOrders)],
            ["Offen", String(stats.pendingOrders)],
            ["Abgeschlossen", String(stats.completedOrders)],
            ["Umsatz heute", formatEuro(stats.dailySalesCents)],
          ].map(([label, value]) => (
            <div key={label} className="bg-white p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-mute">{label}</p>
              <p className="mt-2 font-display text-4xl">{value}</p>
            </div>
          ))}
          <div className="bg-white p-5 sm:col-span-4">
            <p className="text-sm font-medium">Letzte Aktivität</p>
            <ul className="mt-3 divide-y divide-ink/10 text-sm">
              {stats.recent.map((order) => (
                <li key={order.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>#{order.publicNumber} {order.customerFirstName} {order.customerLastName}</span>
                  <span>{order.status} · {formatEuro(order.totalCents)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {tab === "orders" ? (
        <div className="mt-6 grid gap-4">
          {orders.map((order) => (
            <article key={order.id} className="bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl">#{order.publicNumber}</h2>
                  <p className="text-sm text-mute">{order.customerFirstName} {order.customerLastName} · {order.customerPhone} · {order.fulfillment}</p>
                  <p className="text-sm text-mute">{order.street} {order.postalCode} {order.city} {order.deliveryArea ? `· ${order.deliveryArea.locality}` : ""}</p>
                </div>
                <select value={order.status} onChange={(event) => void updateStatus(order.id, event.target.value)} className="border border-ink/15 px-2 py-2">
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </div>
              <ul className="mt-3 text-sm">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}× {item.productName} ({item.variantLabel}) · {formatEuro(item.lineTotalCents)}
                    {item.customizationJson?.choices?.length ? ` · ${item.customizationJson.choices.map((choice) => choice.label).join(", ")}` : ""}
                    {item.customizationJson?.extras?.length ? ` · ${item.customizationJson.extras.map((extra) => extra.name).join(", ")}` : ""}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm">Zahlung {order.payment?.method} · {order.payment?.status} · Gesamt {formatEuro(order.totalCents)}</p>
              {order.notes ? <p className="mt-1 text-sm text-mute">Hinweis: {order.notes}</p> : null}
            </article>
          ))}
        </div>
      ) : null}

      {tab === "menu" ? (
        <div className="mt-6 overflow-x-auto bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-ink/10 text-mute">
              <tr><th className="p-3">Nr.</th><th>Name</th><th>Kategorie</th><th>Preise</th><th>Status</th></tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-ink/5">
                  <td className="p-3">{product.sku}</td>
                  <td>{product.name}</td>
                  <td>{product.category.name}</td>
                  <td>
                    {product.variants.map((variant) => (
                      <span key={variant.id} className="mr-3 inline-flex items-center gap-2">
                        {variant.label}
                        <input
                          className="w-20 border border-ink/15 px-2 py-1"
                          defaultValue={(variant.priceCents / 100).toFixed(2)}
                          onBlur={(event) => {
                            const priceCents = Math.round(Number(event.target.value.replace(",", ".")) * 100);
                            if (!Number.isFinite(priceCents)) return;
                            void api(`/api/admin/products/${product.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({
                                categoryId: product.category.id,
                                sku: product.sku,
                                name: product.name,
                                description: product.description,
                                allergenCodes: product.allergenCodes,
                                available: product.available,
                                isOffer: product.isOffer,
                                variants: product.variants.map((entry) => ({
                                  id: entry.id,
                                  label: entry.label,
                                  detail: entry.detail,
                                  includedExtraCount: entry.includedExtraCount,
                                  priceCents: entry.id === variant.id ? priceCents : entry.priceCents,
                                })),
                              }),
                            }).then(load);
                          }}
                        />
                      </span>
                    ))}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="underline"
                      onClick={() =>
                        void api(`/api/admin/products/${product.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({
                            categoryId: product.category.id,
                            sku: product.sku,
                            name: product.name,
                            description: product.description,
                            allergenCodes: product.allergenCodes,
                            available: !product.available,
                            isOffer: product.isOffer,
                            variants: product.variants.map((entry) => ({
                              id: entry.id,
                              label: entry.label,
                              detail: entry.detail,
                              priceCents: entry.priceCents,
                              includedExtraCount: entry.includedExtraCount,
                            })),
                          }),
                        }).then(load)
                      }
                    >
                      {product.available ? "Verfügbar" : "Ausgeblendet"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="bg-white p-4">
            <h2 className="font-display text-3xl">Zeiten</h2>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={holidayMode} onChange={(event) => setHolidayMode(event.target.checked)} />
              Feiertagszeiten heute verwenden
            </label>
            <label className="mt-3 block text-sm">
              Mindestbestellwert Abholung in Cent
              <input className="mt-1 w-full border border-ink/15 px-3 py-2" value={pickupMinimum} onChange={(event) => setPickupMinimum(Number(event.target.value))} />
            </label>
            <button type="button" className="mt-3 bg-ink px-3 py-2 text-sm text-cream" onClick={() => void api("/api/admin/restaurant", { method: "PATCH", body: JSON.stringify({ holidayMode, pickupMinimumCents: pickupMinimum }) })}>
              Speichern
            </button>
            <div className="mt-4 grid gap-2">
              {hours.map((hour) => (
                <form
                  key={hour.id}
                  className="grid grid-cols-2 items-center gap-2 border-b border-ink/10 pb-3 text-sm last:border-0 sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_auto] sm:border-0 sm:pb-0"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    void api(`/api/admin/hours/${hour.id}`, { method: "PATCH", body: JSON.stringify({ opens: data.get("opens"), closes: data.get("closes") }) });
                  }}
                >
                  <span className="col-span-2 sm:col-span-1">{hour.label}</span>
                  <input name="opens" defaultValue={hour.opens} className="border border-ink/15 px-2 py-1" />
                  <input name="closes" defaultValue={hour.closes} className="border border-ink/15 px-2 py-1" />
                  <button className="underline">OK</button>
                </form>
              ))}
            </div>
          </section>
          <section className="bg-white p-4">
            <h2 className="font-display text-3xl">Liefergebiete</h2>
            <div className="mt-3 max-h-96 space-y-2 overflow-y-auto text-sm">
              {areas.map((area) => (
                <form
                  key={area.id}
                  className="grid grid-cols-2 gap-2 border-b border-ink/10 pb-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_5rem_5rem_auto] sm:items-center sm:border-0 sm:pb-0"
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
                  <input name="minimum" defaultValue={(area.minimumOrderCents / 100).toFixed(2)} className="border border-ink/15 px-2 py-1" />
                  <input name="fee" placeholder="Gebühr" defaultValue={area.deliveryFeeCents == null ? "" : (area.deliveryFeeCents / 100).toFixed(2)} className="border border-ink/15 px-2 py-1" />
                  <button className="underline">OK</button>
                </form>
              ))}
            </div>
          </section>
          {promotion ? (
            <section className="bg-white p-4 lg:col-span-2">
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
                <input name="title" defaultValue={promotion.title} className="border border-ink/15 px-3 py-2" />
                <textarea name="body" defaultValue={promotion.body} className="min-h-24 border border-ink/15 px-3 py-2" />
                <input name="minimum" defaultValue={((promotion.minimumOrderCents ?? 0) / 100).toFixed(2)} className="border border-ink/15 px-3 py-2" />
                <label className="text-sm"><input type="checkbox" name="active" defaultChecked={promotion.active} /> Anzeigen</label>
                <button className="w-fit bg-ink px-3 py-2 text-sm text-cream">Speichern</button>
              </form>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
