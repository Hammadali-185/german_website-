"use client";

import Image from "next/image";
import { useState } from "react";
import {
  defaultSelection,
  getOptionGroups,
  unitPriceCents,
  type CartSelection,
  type OptionGroup,
} from "@/content/ordering";
import { getItemById } from "@/content/menu";
import { useCart } from "@/components/cart-context";
import { Price } from "@/components/Price";
import { useDialog } from "@/components/useDialog";
import { formatEuro } from "@/lib/format";
import { MAX_QUANTITY } from "@/lib/cart";
import styles from "./ItemCustomizer.module.css";

export function ItemCustomizer() {
  const { customizerItemId, closeCustomizer } = useCart();
  const ref = useDialog(customizerItemId !== null, closeCustomizer);

  if (!customizerItemId) return null;

  let item;
  try {
    item = getItemById(customizerItemId);
  } catch {
    return null;
  }

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Auswahl schließen"
        onClick={closeCustomizer}
      />
      <div
        ref={ref}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="customizer-title"
        tabIndex={-1}
      >
        <CustomizerForm key={item.id} itemId={item.id} onClose={closeCustomizer} />
      </div>
    </div>
  );
}

function CustomizerForm({
  itemId,
  onClose,
}: {
  itemId: string;
  onClose: () => void;
}) {
  const item = getItemById(itemId);
  const groups = getOptionGroups(item);
  const { addToCart } = useCart();
  const [selection, setSelection] = useState<CartSelection>(() =>
    defaultSelection(groups),
  );
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState(1);
  const unit = unitPriceCents(item.id, selection);
  const total = unit * quantity;

  function choose(group: OptionGroup, choiceId: string) {
    setSelection((current) => {
      const existing = current[group.id] ?? [];
      const next =
        group.mode === "single"
          ? [choiceId]
          : existing.includes(choiceId)
            ? existing.filter((id) => id !== choiceId)
            : [...existing, choiceId];
      return { ...current, [group.id]: next };
    });
  }

  return (
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          addToCart({ itemId: item.id, quantity, selection, note });
        }}
      >
        <div className={styles.scroll}>
          <div className={styles.hero}>
            <div className={styles.media}>
              <Image
                src={item.image}
                alt={item.imageAlt}
                fill
                sizes="(max-width: 800px) 100vw, 240px"
                className={styles.photo}
              />
            </div>
            <div>
              <p className={styles.kicker}>Anpassen</p>
              <h2 id="customizer-title">{item.name}</h2>
              <p className={styles.description}>{item.description}</p>
            </div>
          </div>
          {groups.map((group) => (
          <fieldset key={group.id} className={styles.group}>
            <legend>{group.name}</legend>
            <div className={styles.choices}>
              {group.choices.map((choice) => {
                const checked = (selection[group.id] ?? []).includes(choice.id);
                return (
                  <label
                    key={choice.id}
                    className={`${styles.choice} ${checked ? styles.choiceOn : ""}`}
                  >
                    <input
                      type={group.mode === "single" ? "radio" : "checkbox"}
                      name={group.id}
                      checked={checked}
                      onChange={() => choose(group, choice.id)}
                    />
                    <span>{choice.name}</span>
                    <span className={styles.choicePrice}>
                      {choice.priceCents > 0
                        ? `+ ${formatEuro(choice.priceCents)}`
                        : "inklusive"}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}

        <label className={styles.noteLabel} htmlFor="special-note">
            Sonderwunsch
            <textarea
              id="special-note"
              value={note}
              maxLength={140}
              rows={3}
              placeholder="Zum Beispiel ohne Zwiebeln. Optional."
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>

        <div className={styles.bar}>
          <div className={styles.qty} role="group" aria-label="Menge">
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              disabled={quantity <= 1}
              aria-label="Weniger"
            >
              −
            </button>
            <span>{quantity}</span>
            <button
              type="button"
              onClick={() =>
                setQuantity((value) => Math.min(MAX_QUANTITY, value + 1))
              }
              disabled={quantity >= MAX_QUANTITY}
              aria-label="Mehr"
            >
              +
            </button>
          </div>
          <button type="submit" className={styles.submit}>
            In den Warenkorb · <Price cents={total} />
          </button>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </form>
  );
}
