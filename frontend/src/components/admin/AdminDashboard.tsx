"use client";

import { api } from "@/lib/api";
import { openSocket, rememberEvent, type LiveSocket } from "@/lib/realtime";
import { createLiveFallback } from "@pizzablitz/shared";
import {
  BarChart3,
  Cable,
  ChefHat,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeft,
  Puzzle,
  Settings,
  ShoppingBag,
  Ticket,
  Truck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DashboardHome } from "./DashboardHome";
import { CatalogDesk } from "./CatalogDesk";
import { CouponDesk } from "./CouponDesk";
import { CustomerDesk } from "./CustomerDesk";
import { OffersDesk } from "./OffersDesk";
import { ReportsDesk } from "./ReportsDesk";
import { SettingsPanel } from "./ExistingPanels";
import { StatusDesk } from "./StatusDesk";
import { OrderDesk } from "./OrderDesk";

type AdminUser = { id: string; email: string; firstName: string; lastName: string; role: string };
type Section = "dashboard" | "orders" | "deliveries" | "catalog" | "customers" | "reports" | "coupons" | "offers" | "extensions" | "connections" | "settings";
type Area = Parameters<typeof SettingsPanel>[0]["areas"][number];
type Hour = Parameters<typeof SettingsPanel>[0]["hours"][number];
type Promotion = Parameters<typeof SettingsPanel>[0]["promotion"];

const groups: { label: string; items: { id: Section; label: string; icon: typeof LayoutDashboard; ready: boolean }[] }[] = [
  {
    label: "Hauptmenü",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, ready: true },
      { id: "orders", label: "Bestellungen", icon: ShoppingBag, ready: true },
      { id: "deliveries", label: "Lieferungen", icon: Truck, ready: true },
      { id: "catalog", label: "Katalog", icon: ChefHat, ready: true },
      { id: "customers", label: "Kunden", icon: Users, ready: true },
      { id: "reports", label: "Berichte", icon: BarChart3, ready: true },
    ],
  },
  {
    label: "Marketing",
    items: [
      { id: "coupons", label: "Gutscheine", icon: Ticket, ready: true },
      { id: "offers", label: "Angebote", icon: ShoppingBag, ready: true },
    ],
  },
  {
    label: "Systemverwaltung",
    items: [
      { id: "extensions", label: "Erweiterungen", icon: Puzzle, ready: true },
      { id: "connections", label: "Verbindungen", icon: Cable, ready: true },
      { id: "settings", label: "Einstellungen", icon: Settings, ready: true },
    ],
  },
];

function beep() {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 880;
  gain.gain.value = 0.04;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.18);
  oscillator.onended = () => void context.close();
}

export function AdminDashboard() {
  const [user, setUser] = useState<AdminUser | null | undefined>(undefined);
  const [section, setSection] = useState<Section>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [error, setError] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [hours, setHours] = useState<Hour[]>([]);
  const [promotion, setPromotion] = useState<Promotion>(null);
  const [holidayMode, setHolidayMode] = useState(false);
  const [pickupMinimum, setPickupMinimum] = useState(0);
  const [preparationMinutes, setPreparationMinutes] = useState<number | null>(null);
  const [deliveryMinutesPerKm, setDeliveryMinutesPerKm] = useState<number | null>(null);
  const [live, setLive] = useState(false);
  const [sound, setSound] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [freshIds, setFreshIds] = useState<string[]>([]);
  const seenEvents = useRef(new Set<string>());
  const socketGeneration = useRef(0);

  useEffect(() => {
    setSound(window.localStorage.getItem("pb-order-sound") === "1");
    setCollapsed(window.localStorage.getItem("pb-admin-sidebar") === "1");
    api<{ user: AdminUser | null }>("/api/auth/me")
      .then((result) => setUser(result.user && result.user.role === "ADMIN" ? result.user : null))
      .catch(() => setUser(null));
  }, []);

  async function loadSettings() {
    const [restaurant, nextAreas] = await Promise.all([
      api<{ holidayMode: boolean; pickupMinimumCents: number; preparationMinutes: number | null; deliveryMinutesPerKm: number | null; hours: Hour[]; announcement: Promotion }>("/api/restaurant"),
      api<Area[]>("/api/delivery/areas"),
    ]);
    setHours(restaurant.hours);
    setPromotion(restaurant.announcement);
    setHolidayMode(restaurant.holidayMode);
    setPickupMinimum(restaurant.pickupMinimumCents);
    setPreparationMinutes(restaurant.preparationMinutes);
    setDeliveryMinutesPerKm(restaurant.deliveryMinutesPerKm);
    setAreas(nextAreas);
    return restaurant;
  }

  useEffect(() => {
    if (!user) return;
    setError("");
    const task = section === "settings" ? loadSettings() : Promise.resolve();
    task.catch((caught) => setError(caught instanceof Error ? caught.message : "Admin-Daten konnten nicht geladen werden."));
  }, [section, user]);

  useEffect(() => {
    if (!user) return;
    const generation = socketGeneration.current + 1;
    socketGeneration.current = generation;
    let stopped = false;
    let socket: LiveSocket | null = null;
    const fallback = createLiveFallback(20000, () => setRefreshKey((value) => value + 1));
    api<{ token: string }>("/api/realtime/ticket", { method: "POST", body: "{}" })
      .then((ticket) => {
        if (stopped || generation !== socketGeneration.current) return;
        socket = openSocket({ ticket: ticket.token });
        socket.on("connect", () => {
          setLive(true);
          fallback.connected();
          setRefreshKey((value) => value + 1);
          socket?.emit("admin:join");
        });
        socket.on("disconnect", () => { setLive(false); fallback.disconnected(); });
        socket.on("connect_error", () => { setLive(false); fallback.disconnected(); });
        socket.on("order:new", (event: { eventId: string; order: { id: string } }) => {
          if (!rememberEvent(seenEvents.current, event.eventId)) return;
          setFreshIds((current) => current.includes(event.order.id) ? current : [event.order.id, ...current].slice(0, 30));
          setRefreshKey((value) => value + 1);
          if (window.localStorage.getItem("pb-order-sound") === "1") beep();
        });
        socket.on("order:status", (event: { eventId: string }) => {
          if (!rememberEvent(seenEvents.current, event.eventId)) return;
          setRefreshKey((value) => value + 1);
        });
      })
      .catch(() => { if (!stopped) fallback.disconnected(); });
    return () => {
      stopped = true;
      fallback.stop();
      socket?.disconnect();
    };
  }, [user]);

  if (user === undefined) return <div className="grid min-h-screen place-items-center bg-[#F4F5F7] text-sm text-neutral-500">Anmeldung wird geprüft…</div>;
  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F4F5F7] px-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p>Dieser Bereich ist nur für die Verwaltung.</p>
          <Link href="/login" className="mt-4 inline-block text-[#C8102E]">Anmelden</Link>
        </div>
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className={`flex items-center gap-3 px-4 py-5 ${collapsed ? "justify-center" : ""}`}>
        <img src="/images/original/logo.png" alt="" className="h-9 w-9 object-contain" />
        {collapsed ? null : <span className="font-display text-xl leading-none text-white">Pizza Blitz</span>}
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-2 pb-4">
        {groups.map((group) => (
          <div key={group.label}>
            {collapsed ? null : <p className="px-3 pb-2 text-[11px] uppercase tracking-[0.16em] text-white/40">{group.label}</p>}
            <div className="grid gap-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    onClick={() => { setSection(item.id); setMobileOpen(false); }}
                    className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm transition ${active ? "bg-[#C8102E] text-white" : "text-white/75 hover:bg-white/10"} ${collapsed ? "justify-center" : ""}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {collapsed ? null : <span>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        {collapsed ? null : (
          <div className="px-2 pb-3">
            <p className="truncate text-sm text-white">{user.firstName} {user.lastName}</p>
            <p className="truncate text-xs text-white/50">{user.email}</p>
          </div>
        )}
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm text-white/80 hover:bg-white/10"
          onClick={() => void api("/api/auth/logout", { method: "POST" }).then(() => { window.location.href = "/login"; })}
        >
          <LogOut className="h-4 w-4" />
          {collapsed ? null : "Abmelden"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-[#1C1F22]">
      <aside className={`fixed inset-y-0 left-0 z-40 hidden bg-[#1C1F22] transition-[width] lg:block ${collapsed ? "w-[4.5rem]" : "w-64"}`}>{sidebar}</aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Menü schließen" className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative h-full w-72 bg-[#1C1F22]">{sidebar}</aside>
        </div>
      ) : null}
      <div className={collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64"}>
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-neutral-200 bg-white/95 px-4 backdrop-blur">
          <button type="button" className="grid h-10 w-10 place-items-center rounded-lg border border-neutral-200 lg:hidden" aria-label="Menü" onClick={() => setMobileOpen(true)}>
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="hidden h-10 w-10 place-items-center rounded-lg border border-neutral-200 lg:grid"
            aria-label="Seitenleiste einklappen"
            onClick={() => {
              setCollapsed((value) => {
                window.localStorage.setItem("pb-admin-sidebar", value ? "0" : "1");
                return !value;
              });
            }}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <p className="text-sm text-neutral-500">{groups.flatMap((group) => group.items).find((item) => item.id === section)?.label}</p>
          <label className="ml-auto flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sound}
              onChange={(event) => {
                setSound(event.target.checked);
                window.localStorage.setItem("pb-order-sound", event.target.checked ? "1" : "0");
              }}
            />
            Ton
          </label>
          <span className={`text-xs ${live ? "text-emerald-700" : "text-neutral-400"}`}>{live ? "Live" : "Getrennt"}</span>
        </header>
        <main className="px-4 py-6 sm:px-6">
          {error ? <p className="mb-4 rounded-xl bg-white p-4 text-sm text-[#C8102E]">{error}</p> : null}
          {section === "dashboard" ? <DashboardHome refreshKey={refreshKey} live={live} /> : null}
          {section === "orders" ? <OrderDesk mode="orders" refreshKey={refreshKey} freshIds={freshIds} /> : null}
          {section === "deliveries" ? <OrderDesk mode="deliveries" refreshKey={refreshKey} freshIds={freshIds} /> : null}
          {section === "catalog" ? <CatalogDesk /> : null}
          {section === "customers" ? <CustomerDesk /> : null}
          {section === "reports" ? <ReportsDesk /> : null}
          {section === "coupons" ? <CouponDesk /> : null}
          {section === "offers" ? <OffersDesk /> : null}
          {section === "extensions" ? <StatusDesk mode="extensions" /> : null}
          {section === "connections" ? <StatusDesk mode="connections" /> : null}
          {section === "settings" ? (
            <SettingsPanel
              hours={hours}
              areas={areas}
              promotion={promotion}
              holidayMode={holidayMode}
              pickupMinimum={pickupMinimum}
              onHoliday={setHolidayMode}
              onPickup={setPickupMinimum}
              preparationMinutes={preparationMinutes}
              deliveryMinutesPerKm={deliveryMinutesPerKm}
              onPreparation={setPreparationMinutes}
              onTravel={setDeliveryMinutesPerKm}
              onSaveRestaurant={() => void api("/api/admin/restaurant", { method: "PATCH", body: JSON.stringify({ holidayMode, pickupMinimumCents: pickupMinimum, preparationMinutes, deliveryMinutesPerKm }) })}
            />
          ) : null}
          {section !== "dashboard" && section !== "orders" && section !== "deliveries" && section !== "catalog" && section !== "customers" && section !== "reports" && section !== "coupons" && section !== "offers" && section !== "extensions" && section !== "connections" && section !== "settings" ? (
            <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h1 className="font-display text-3xl">{groups.flatMap((group) => group.items).find((item) => item.id === section)?.label}</h1>
              <p className="mt-3 max-w-xl text-sm text-neutral-600">Dieser Bereich ist noch nicht freigeschaltet. Es werden keine Beispieldaten angezeigt.</p>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
