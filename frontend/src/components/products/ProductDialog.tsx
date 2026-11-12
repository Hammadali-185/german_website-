"use client";

import { formatEuro } from "@/lib/format";
import { toast } from "@/components/layout/Providers";
import { useCart } from "@/store/cart";
import type { Product, Variant } from "@/types/catalog";
import { priceLine } from "@pizzablitz/shared";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function ProductDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const add = useCart((state) => state.add);
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const variant = product.variants.find((entry) => entry.id === variantId) ?? product.variants[0];

  const selectedChoices = useMemo(() => {
    if (!variant) return [];
    return variant.choiceGroups
      .map((group) => {
        const selected = choices[group.id] ?? (group.selectionType === "SELECT" ? group.options[0]?.id : "");
        const option = group.options.find((entry) => entry.id === selected);
        return option ? { id: option.id, group: group.name, label: option.label, priceCents: option.priceCents, groupId: group.id, required: group.required } : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, [choices, variant]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!variant) return null;
  const selectedExtras = extras.map((id) => variant.extras.find((extra) => extra.id === id)).filter((extra): extra is NonNullable<typeof extra> => Boolean(extra));
  const priced = priceLine({
    basePriceCents: variant.priceCents,
    choices: selectedChoices,
    extras: selectedExtras,
    includedExtraCount: variant.includedExtraCount,
    quantity,
  });
  const missing = variant.choiceGroups.filter((group) => group.required && !selectedChoices.some((choice) => choice.groupId === group.id));

  function changeVariant(next: Variant) {
    setVariantId(next.id);
    setExtras([]);
    setChoices({});
  }

  function submit() {
    if (missing.length) {
      toast(`Bitte ${missing[0].name} auswählen.`);
      return;
    }
    add({
      productId: product.id,
      variantId: variant.id,
      sku: product.sku,
      name: product.name,
      variantLabel: variant.detail ? `${variant.label} ${variant.detail}` : variant.label,
      quantity,
      basePriceCents: variant.priceCents,
      includedExtraCount: variant.includedExtraCount,
      choices: selectedChoices.map(({ id, group, label, priceCents }) => ({ id, group, label, priceCents })),
      extras: selectedExtras.map((extra) => ({ id: extra.id, name: extra.name, priceCents: extra.priceCents })),
      orderingEnabled: product.orderingEnabled,
    });
    toast(product.orderingEnabled ? "In den Warenkorb gelegt." : "Zur Ansicht hinzugefügt. Bestellen braucht die verbundene API.");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-end sm:place-items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-forest/40" aria-label="Dialog schließen" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="product-title" className="relative flex max-h-[78dvh] w-full flex-col rounded-t-3xl bg-cream shadow-card sm:h-auto sm:max-h-[min(86dvh,760px)] sm:max-w-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-4 py-3 sm:px-7">
          <p className="pt-2 text-xs uppercase tracking-[0.16em] text-brand sm:tracking-[0.2em]">Nr. {product.sku}</p>
          <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center border border-ink/10" aria-label="Schließen">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-7 sm:py-6">
        <h2 id="product-title" className="font-display text-2xl leading-none sm:text-4xl">
          {product.name}
        </h2>
        {product.description ? <p className="mt-3 max-w-xl text-sm leading-6 text-mute">{product.description}</p> : null}
        {product.allergenCodes ? <p className="mt-2 text-xs text-mute">Kennzeichnung: {product.allergenCodes}</p> : null}

        {product.variants.length > 1 ? (
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {product.variants.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => changeVariant(entry)}
                className={`min-h-16 border px-3 py-3 text-left ${entry.id === variant.id ? "border-brand bg-white" : "border-ink/10"}`}
              >
                <span className="block text-sm font-medium">{entry.label}</span>
                <span className="block text-xs text-mute">{entry.detail}</span>
                <span className="mt-1 block text-sm">{formatEuro(entry.priceCents)}</span>
              </button>
            ))}
          </div>
        ) : null}

        {variant.choiceGroups.map((group) => (
          <fieldset key={group.id} className="mt-5">
            <legend className="text-sm font-semibold">{group.name}</legend>
            {group.selectionType === "SELECT" ? (
              <select
                className="mt-2 w-full border border-ink/15 bg-white px-3 py-3"
                value={choices[group.id] ?? group.options[0]?.id ?? ""}
                onChange={(event) => setChoices((current) => ({ ...current, [group.id]: event.target.value }))}
              >
                {group.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                    {option.priceCents ? ` (+${formatEuro(option.priceCents)})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="mt-2 grid gap-2">
                {group.options.map((option) => (
                  <label key={option.id} className="flex min-h-11 items-center gap-3 border border-ink/10 bg-white px-3 py-2 text-sm">
                    <input
                      type="radio"
                      name={group.id}
                      checked={(choices[group.id] ?? "") === option.id}
                      onChange={() => setChoices((current) => ({ ...current, [group.id]: option.id }))}
                    />
                    <span>
                      {option.label}
                      {option.priceCents ? ` (+${formatEuro(option.priceCents)})` : ""}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        ))}

        {variant.extras.length > 0 ? (
          <div className="mt-5">
            <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <h3 className="text-sm font-semibold">Extrazutaten</h3>
              {variant.includedExtraCount > 0 ? (
                <p className="text-xs text-mute">Die ersten {variant.includedExtraCount} Extras sind enthalten.</p>
              ) : null}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:max-h-56 sm:grid-cols-2 sm:overflow-y-auto">
              {variant.extras.map((extra) => {
                const active = extras.includes(extra.id);
                return (
                  <button
                    key={extra.id}
                    type="button"
                    onClick={() => setExtras((current) => (active ? current.filter((id) => id !== extra.id) : [...current, extra.id]))}
                    className={`flex min-h-11 items-center justify-between gap-3 border px-3 py-2 text-left text-sm ${active ? "border-brand bg-white" : "border-ink/10"}`}
                  >
                    <span className="min-w-0">{extra.name}</span>
                    <span className="shrink-0 text-mute">{extra.priceCents ? formatEuro(extra.priceCents) : "0,00 €"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        </div>
        <div className="flex flex-col gap-3 border-t border-ink/10 bg-cream px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-7" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="flex items-center self-start border border-ink/15">
            <button type="button" className="h-11 w-11" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Menge verringern">
              −
            </button>
            <span className="w-8 text-center">{quantity}</span>
            <button type="button" className="h-11 w-11" onClick={() => setQuantity((value) => value + 1)} aria-label="Menge erhöhen">
              +
            </button>
          </div>
          <button type="button" onClick={submit} disabled={!product.available} className="min-h-12 w-full rounded-full bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-40 sm:w-auto">
            {product.available ? `In den Warenkorb · ${formatEuro(priced.lineTotalCents)}` : "Nicht verfügbar"}
          </button>
        </div>
      </div>
    </div>
  );
}
