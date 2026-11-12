"use client";

import { formatEuro } from "@/lib/format";
import { priceCartLine, useCart } from "@/store/cart";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export function CartPanel({ onClose }: { onClose?: () => void }) {
  const lines = useCart((state) => state.lines);
  const setQuantity = useCart((state) => state.setQuantity);
  const remove = useCart((state) => state.remove);
  const subtotal = lines.reduce((sum, line) => sum + priceCartLine(line).lineTotalCents, 0);
  const orderingEnabled = lines.every((line) => line.orderingEnabled);

  return (
    <div className="flex h-full flex-col bg-cream">
      <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-mute">Warenkorb</p>
          <p className="font-display text-2xl">{lines.reduce((sum, line) => sum + line.quantity, 0)} Artikel</p>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Warenkorb schließen" className="grid h-10 w-10 place-items-center border border-ink/10">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {lines.length === 0 ? (
          <div className="grid min-h-40 place-items-center text-center text-sm text-mute">
            <ShoppingBag className="mx-auto mb-3 h-6 w-6" />
            Dein Warenkorb ist leer.
          </div>
        ) : (
          lines.map((line) => {
            const priced = priceCartLine(line);
            return (
              <article key={line.key} className="border-b border-ink/10 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{line.name}</h3>
                    <p className="text-sm text-mute">
                      Nr. {line.sku} · {line.variantLabel}
                    </p>
                  </div>
                  <button type="button" onClick={() => remove(line.key)} className="text-xs text-mute underline">
                    Entfernen
                  </button>
                </div>
                {line.choices.length > 0 ? <p className="mt-2 text-sm text-mute">{line.choices.map((choice) => choice.label).join(", ")}</p> : null}
                {line.extras.length > 0 ? (
                  <p className="mt-1 text-sm text-mute">Extras: {line.extras.map((extra) => extra.name).join(", ")}</p>
                ) : null}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center border border-ink/15">
                    <button type="button" className="grid h-11 w-11 place-items-center" onClick={() => setQuantity(line.key, line.quantity - 1)} aria-label="Menge verringern">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center text-sm">{line.quantity}</span>
                    <button type="button" className="grid h-11 w-11 place-items-center" onClick={() => setQuantity(line.key, line.quantity + 1)} aria-label="Menge erhöhen">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="font-medium">{formatEuro(priced.lineTotalCents)}</p>
                </div>
              </article>
            );
          })
        )}
      </div>
      <div className="border-t border-ink/10 px-5 py-4" style={onClose ? { paddingBottom: "max(1rem, env(safe-area-inset-bottom))" } : undefined}>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-mute">Zwischensumme</span>
          <span className="font-display text-2xl">{formatEuro(subtotal)}</span>
        </div>
        {!orderingEnabled && lines.length > 0 ? (
          <p className="mb-3 text-sm text-mute">Die Bestellung wird aktiv, sobald die API und die Datenbank verbunden sind.</p>
        ) : null}
        <Link
          href="/checkout"
          aria-disabled={lines.length === 0}
          className={`flex min-h-12 items-center justify-center bg-brand px-4 text-center text-sm font-semibold text-white ${lines.length === 0 ? "pointer-events-none opacity-40" : "hover:bg-brand-deep"}`}
        >
          Zur Kasse
        </Link>
      </div>
    </div>
  );
}

export function CartDrawer() {
  const isOpen = useCart((state) => state.isOpen);
  const setOpen = useCart((state) => state.setOpen);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Schließen" onClick={() => setOpen(false)} />
      <div className="absolute inset-y-0 right-0 h-dvh w-full shadow-card sm:max-w-md">
        <CartPanel onClose={() => setOpen(false)} />
      </div>
    </div>
  );
}
