"use client";

import Image from "next/image";
import Link from "next/link";
import { getItemById } from "@/content/menu";
import { selectionLabels } from "@/content/ordering";
import { useCart } from "@/components/cart-context";
import { Price } from "@/components/Price";
import { useDialog } from "@/components/useDialog";
import { MAX_QUANTITY, lineTotalCents } from "@/lib/cart";
import styles from "./CartDrawer.module.css";

export function CartDrawer() {
  const {
    lines,
    cartOpen,
    closeCart,
    subtotalCents,
    setQuantity,
    removeLine,
  } = useCart();
  const ref = useDialog(cartOpen, closeCart);

  if (!cartOpen) return null;

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Warenkorb schließen"
        onClick={closeCart}
      />
      <div
        ref={ref}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        tabIndex={-1}
      >
        <header className={styles.header}>
          <h2 id="cart-title">Warenkorb</h2>
          <button type="button" className={styles.close} onClick={closeCart}>
            Schließen
          </button>
        </header>

        {lines.length === 0 ? (
          <div className={styles.empty}>
            <p>Dein Warenkorb ist leer.</p>
            <p>Such dir auf der Karte etwas aus und pass es an.</p>
            <Link href="/speisekarte" className={styles.primary} onClick={closeCart}>
              Zur Speisekarte
            </Link>
          </div>
        ) : (
          <>
            <ul className={styles.list}>
              {lines.map((line) => {
                const item = getItemById(line.itemId);
                const details = selectionLabels(item, line.selection);
                return (
                  <li key={line.lineId} className={styles.line}>
                    <div className={styles.media}>
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        sizes="72px"
                        className={styles.photo}
                      />
                    </div>
                    <div className={styles.info}>
                      <div className={styles.titleRow}>
                        <p className={styles.name}>{item.name}</p>
                        <Price
                          cents={lineTotalCents(line)}
                          className={styles.linePrice}
                        />
                      </div>
                      {details.length > 0 ? (
                        <p className={styles.details}>{details.join(" · ")}</p>
                      ) : null}
                      {line.note ? <p className={styles.note}>{line.note}</p> : null}
                      <div className={styles.actions}>
                        <div
                          className={styles.qty}
                          role="group"
                          aria-label={`Menge für ${item.name}`}
                        >
                          <button
                            type="button"
                            onClick={() => setQuantity(line.lineId, line.quantity - 1)}
                            disabled={line.quantity <= 1}
                            aria-label="Weniger"
                          >
                            −
                          </button>
                          <span>{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => setQuantity(line.lineId, line.quantity + 1)}
                            disabled={line.quantity >= MAX_QUANTITY}
                            aria-label="Mehr"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className={styles.remove}
                          onClick={() => removeLine(line.lineId)}
                        >
                          Entfernen
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <footer className={styles.footer}>
              <p>
                <span>Zwischensumme</span>
                <Price cents={subtotalCents} />
              </p>
              <p className={styles.total}>
                <span>Gesamt</span>
                <Price cents={subtotalCents} />
              </p>
              <p className={styles.hint}>
                Lieferkosten kommen an der Kasse dazu, wenn du liefern lässt.
              </p>
              <Link href="/kasse" className={styles.primary} onClick={closeCart}>
                Zur Kasse
              </Link>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
