"use client";

import { CartDrawer } from "@/components/cart/CartPanel";
import { formatEuro } from "@/lib/format";
import type { Restaurant } from "@/types/catalog";
import { Menu, ShoppingBag, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { priceCartLine, useCart } from "@/store/cart";

const links = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Speisekarte" },
  { href: "/offers", label: "Angebote" },
  { href: "/about", label: "Über uns" },
  { href: "/contact", label: "Kontakt" },
];

export function SiteHeader({ restaurant }: { restaurant: Restaurant }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [cartReady, setCartReady] = useState(false);
  const cartOpen = useCart((state) => state.isOpen);
  const setCartOpen = useCart((state) => state.setOpen);

  useEffect(() => {
    const update = () => {
      const lines = useCart.getState().lines;
      setCount(lines.reduce((sum, line) => sum + line.quantity, 0));
      setTotal(lines.reduce((sum, line) => sum + priceCartLine(line).lineTotalCents, 0));
    };
    update();
    return useCart.subscribe(update);
  }, []);

  useEffect(() => {
    setCartReady(useCart.persist.hasHydrated());
    return useCart.persist.onFinishHydration(() => setCartReady(true));
  }, []);

  useEffect(() => {
    const reserve = cartReady && count > 0 && !cartOpen && !pathname.startsWith("/checkout") && !pathname.startsWith("/admin");
    document.body.style.paddingBottom = reserve ? "5.25rem" : "";
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [cartOpen, cartReady, count, pathname]);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <div className="sticky top-0 z-40">
      {restaurant.announcement?.active ? (
        <div className="bg-forest px-4 py-3 text-center text-sm font-medium leading-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Telefon</p>
          <p className="mt-1">{restaurant.announcement.body}</p>
        </div>
      ) : null}
      <header className="border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
            <img src={restaurant.logo} alt="Pizza Blitz Logo" className="h-11 w-11 object-contain sm:h-12 sm:w-12" />
            <span className="font-display text-lg leading-none sm:text-xl">
              Pizza
              <br />
              Blitz
            </span>
          </Link>
          <nav className="hidden items-center gap-6 lg:flex">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={`relative text-sm transition after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:origin-left after:bg-brand after:transition-transform ${pathname === link.href ? "text-brand after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100"}`}>
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className={`hidden text-xs md:inline ${restaurant.open ? "text-ink" : "text-mute"}`}>
              {restaurant.open ? "Jetzt geöffnet" : "Geschlossen"}
            </span>
            <Link href="/login" aria-label="Konto" className="grid h-11 w-11 place-items-center rounded-full border border-ink/10 bg-white transition hover:-translate-y-0.5">
              <UserRound className="h-4 w-4" />
            </Link>
            <button type="button" aria-label="Warenkorb" className="relative grid h-11 w-11 place-items-center rounded-full border border-ink/10 bg-white transition hover:-translate-y-0.5" onClick={() => setCartOpen(true)}>
              <ShoppingBag className="h-4 w-4" />
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center bg-brand px-1 text-[11px] text-white">{count}</span>
            </button>
            <button type="button" className="grid h-11 w-11 place-items-center rounded-full border border-ink/10 bg-white lg:hidden" aria-label="Menü" onClick={() => setOpen((value) => !value)}>
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {open ? (
          <nav className="grid border-t border-ink/10 px-4 py-3 lg:hidden">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="border-b border-ink/10 py-4 text-lg last:border-0">
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      </div>
      <CartDrawer />
      {cartReady && count > 0 && !cartOpen && !pathname.startsWith("/checkout") && !pathname.startsWith("/admin") ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-cream/95 p-3 backdrop-blur lg:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <button type="button" onClick={() => setCartOpen(true)} className="flex min-h-12 w-full items-center justify-between rounded-full bg-brand px-4 text-sm font-semibold text-white shadow-card">
            <span>Warenkorb · {count}</span>
            <span>{formatEuro(total)}</span>
          </button>
        </div>
      ) : null}
    </>
  );
}
