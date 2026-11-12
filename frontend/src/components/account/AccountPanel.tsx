"use client";

import { api } from "@/lib/api";
import { formatEuro } from "@/lib/format";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type User = { id: string; email: string; firstName: string; lastName: string; phone: string; role: string };
type Address = { id: string; label: string; street: string; postalCode: string; city: string };
type Order = { id: string; publicNumber: number; status: string; totalCents: number; createdAt: string };

export function AccountPanel() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");

  async function load(current: User) {
    const [nextAddresses, nextOrders] = await Promise.all([
      api<Address[]>("/api/account/addresses"),
      api<Order[]>("/api/orders/my-orders"),
    ]);
    setAddresses(nextAddresses);
    setOrders(nextOrders);
    setUser(current);
  }

  useEffect(() => {
    api<{ user: User | null }>("/api/auth/me")
      .then((data) => {
        if (!data.user) {
          setUser(null);
          return;
        }
        return load(data.user);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Konto nicht verfügbar."));
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = await api<User>("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify({ firstName: data.get("firstName"), lastName: data.get("lastName"), phone: data.get("phone") }),
    });
    setUser(next);
  }

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await api("/api/account/addresses", {
      method: "POST",
      body: JSON.stringify({ label: data.get("label"), street: data.get("street"), postalCode: data.get("postalCode"), city: data.get("city"), extra: "" }),
    });
    if (user) await load(user);
    event.currentTarget.reset();
  }

  if (user === undefined) return <p className="px-4 py-16">Konto wird geladen.</p>;
  if (!user) return <div className="px-4 py-16"><Link href="/login" className="text-brand">Bitte anmelden</Link></div>;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 lg:grid-cols-2">
      <section>
        <h1 className="font-display text-4xl sm:text-5xl">Hallo {user.firstName}</h1>
        <p className="mt-2 text-sm text-mute">{user.email}</p>
        {error ? <p className="mt-3 text-sm text-brand">{error}</p> : null}
        <form onSubmit={saveProfile} className="mt-6 grid gap-3">
          <input name="firstName" defaultValue={user.firstName} className="border border-ink/15 px-3 py-3" />
          <input name="lastName" defaultValue={user.lastName} className="border border-ink/15 px-3 py-3" />
          <input name="phone" defaultValue={user.phone} className="border border-ink/15 px-3 py-3" />
          <button className="min-h-12 bg-ink px-4 text-sm text-cream">Profil speichern</button>
        </form>
        <button
          type="button"
          className="mt-3 text-sm underline"
          onClick={() => api("/api/auth/logout", { method: "POST" }).then(() => setUser(null))}
        >
          Abmelden
        </button>
      </section>
      <section>
        <h2 className="font-display text-3xl">Adressen</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {addresses.map((address) => (
            <li key={address.id} className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-3">
              <span>{address.label}: {address.street}, {address.postalCode} {address.city}</span>
              <button type="button" onClick={() => api(`/api/account/addresses/${address.id}`, { method: "DELETE" }).then(() => load(user))}>Entfernen</button>
            </li>
          ))}
        </ul>
        <form onSubmit={saveAddress} className="mt-4 grid gap-2">
          <input name="label" placeholder="Bezeichnung" defaultValue="Zuhause" className="border border-ink/15 px-3 py-2" />
          <input name="street" required placeholder="Straße" className="border border-ink/15 px-3 py-2" />
          <input name="postalCode" required pattern="\d{5}" placeholder="PLZ" className="border border-ink/15 px-3 py-2" />
          <input name="city" required placeholder="Ort" className="border border-ink/15 px-3 py-2" />
          <button className="min-h-12 bg-brand px-3 text-sm text-white">Adresse speichern</button>
        </form>
        <h2 className="mt-8 font-display text-3xl">Bestellungen</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {orders.length === 0 ? <li className="text-mute">Noch keine Bestellungen.</li> : null}
          {orders.map((order) => (
            <li key={order.id} className="bg-white px-3 py-2">#{order.publicNumber} · {order.status} · {formatEuro(order.totalCents)}</li>
          ))}
        </ul>
        {user.role === "ADMIN" ? <Link href="/admin" className="mt-6 inline-block text-brand">Zum Admin</Link> : null}
      </section>
    </div>
  );
}
