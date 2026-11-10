"use client";

import { useCart } from "@/components/cart-context";

type OrderableProps = {
  itemId: string;
  className?: string;
  children: React.ReactNode;
};

export function Orderable({ itemId, className, children }: OrderableProps) {
  const { openCustomizer } = useCart();

  return (
    <button
      type="button"
      className={className}
      onClick={() => openCustomizer(itemId)}
    >
      {children}
    </button>
  );
}
