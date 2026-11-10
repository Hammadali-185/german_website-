"use client";

import { createContext, use } from "react";
import type { CartSelection } from "@/content/ordering";
import type { CartLine } from "@/lib/cart";

export type AddInput = {
  itemId: string;
  quantity: number;
  selection: CartSelection;
  note: string;
};

export type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  subtotalCents: number;
  cartOpen: boolean;
  customizerItemId: string | null;
  openCart: () => void;
  closeCart: () => void;
  openCustomizer: (itemId: string) => void;
  closeCustomizer: () => void;
  addToCart: (input: AddInput) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  clearCart: () => void;
};

export const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const value = use(CartContext);
  if (!value) {
    throw new Error("useCart muss innerhalb von CartProvider stehen.");
  }
  return value;
}
