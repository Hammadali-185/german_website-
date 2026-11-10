"use client";

import { useCart } from "@/components/cart-context";
import { formatEuro } from "@/lib/format";
import styles from "./MenuBoard.module.css";

export function ItemHit({
  itemId,
  name,
  priceCents,
}: {
  itemId: string;
  name: string;
  priceCents: number;
}) {
  const { openCustomizer } = useCart();

  return (
    <button
      type="button"
      className={styles.hit}
      onClick={() => openCustomizer(itemId)}
    >
      <span className="srOnly">
        {name} anpassen, {formatEuro(priceCents)}
      </span>
    </button>
  );
}
