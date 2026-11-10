"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { CartDrawer } from "@/components/CartDrawer";
import { ItemCustomizer } from "@/components/ItemCustomizer";
import {
  CartContext,
  type AddInput,
  type CartContextValue,
} from "@/components/cart-context";
import {
  cartCount,
  cartStore,
  cartSubtotalCents,
} from "@/lib/cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const lines = useSyncExternalStore(
    cartStore.subscribe,
    cartStore.getSnapshot,
    cartStore.getServerSnapshot,
  );
  const [cartOpen, setCartOpen] = useState(false);
  const [customizerItemId, setCustomizerItemId] = useState<string | null>(null);

  const openCart = useCallback(() => {
    setCustomizerItemId(null);
    setCartOpen(true);
  }, []);

  const closeCart = useCallback(() => setCartOpen(false), []);

  const openCustomizer = useCallback((itemId: string) => {
    setCartOpen(false);
    setCustomizerItemId(itemId);
  }, []);

  const closeCustomizer = useCallback(() => setCustomizerItemId(null), []);

  const addToCart = useCallback((input: AddInput) => {
    cartStore.addLine(input);
    setCustomizerItemId(null);
    setCartOpen(true);
  }, []);

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    cartStore.setQuantity(lineId, quantity);
  }, []);

  const removeLine = useCallback((lineId: string) => {
    cartStore.removeLine(lineId);
  }, []);

  const clearCart = useCallback(() => {
    cartStore.clear();
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      itemCount: cartCount(lines),
      subtotalCents: cartSubtotalCents(lines),
      cartOpen,
      customizerItemId,
      openCart,
      closeCart,
      openCustomizer,
      closeCustomizer,
      addToCart,
      setQuantity,
      removeLine,
      clearCart,
    }),
    [
      lines,
      cartOpen,
      customizerItemId,
      openCart,
      closeCart,
      openCustomizer,
      closeCustomizer,
      addToCart,
      setQuantity,
      removeLine,
      clearCart,
    ],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartDrawer />
      <ItemCustomizer />
    </CartContext.Provider>
  );
}
