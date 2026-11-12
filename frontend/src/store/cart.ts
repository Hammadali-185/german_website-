"use client";

import { cartLineKey, priceLine } from "@pizzablitz/shared";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartChoice = { id: string; group: string; label: string; priceCents: number };
export type CartExtra = { id: string; name: string; priceCents: number };

export type CartLine = {
  key: string;
  productId: string;
  variantId: string;
  sku: string;
  name: string;
  variantLabel: string;
  quantity: number;
  basePriceCents: number;
  includedExtraCount: number;
  choices: CartChoice[];
  extras: CartExtra[];
  orderingEnabled: boolean;
};

type Draft = Omit<CartLine, "key" | "quantity"> & { quantity?: number };

type CartState = {
  lines: CartLine[];
  isOpen: boolean;
  add: (line: Draft) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      isOpen: false,
      setOpen: (isOpen) => set({ isOpen }),
      add: (line) => {
        const key = cartLineKey({
          productId: line.productId,
          variantId: line.variantId,
          choiceIds: line.choices.map((choice) => choice.id),
          extraIds: line.extras.map((extra) => extra.id),
        });
        const existing = get().lines.find((item) => item.key === key);
        const quantity = line.quantity ?? 1;
        if (existing) {
          set({
            isOpen: true,
            lines: get().lines.map((item) => (item.key === key ? { ...item, quantity: item.quantity + quantity } : item)),
          });
          return;
        }
        set({ isOpen: true, lines: [...get().lines, { ...line, key, quantity }] });
      },
      setQuantity: (key, quantity) =>
        set({
          lines:
            quantity < 1
              ? get().lines.filter((line) => line.key !== key)
              : get().lines.map((line) => (line.key === key ? { ...line, quantity } : line)),
        }),
      remove: (key) => set({ lines: get().lines.filter((line) => line.key !== key) }),
      clear: () => set({ lines: [] }),
    }),
    { name: "pizzablitz-cart", partialize: (state) => ({ lines: state.lines }) },
  ),
);

export function priceCartLine(line: CartLine) {
  return priceLine({
    basePriceCents: line.basePriceCents,
    choices: line.choices,
    extras: line.extras,
    includedExtraCount: line.includedExtraCount,
    quantity: line.quantity,
  });
}

export function useCartCount() {
  return useCart((state) => state.lines.reduce((sum, line) => sum + line.quantity, 0));
}
