"use client";

import { formatEuro } from "@/lib/format";
import { toast } from "@/components/layout/Providers";
import { useCart } from "@/store/cart";
import type { ExtraOption, Product, Variant } from "@/types/catalog";
import { extraCountsTowardIncluded, priceLine } from "@pizzablitz/shared";
import { Check, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const ANGEBOT_3_SKU = "222";

function isSideChoiceGroup(name: string) {
  return /ihre\s*wahl/i.test(name) && !/salat/i.test(name);
}

function isPremiumExtra(extra: ExtraOption) {
  return !extraCountsTowardIncluded(extra.name);
}

export function ProductDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const add = useCart((state) => state.add);
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const variant = product.variants.find((entry) => entry.id === variantId) ?? product.variants[0];
  const enhanceOffer = product.isOffer && product.sku !== ANGEBOT_3_SKU;

  const selectedChoices = useMemo(() => {
    if (!variant) return [];
    return variant.choiceGroups
      .map((group) => {
        const selected = choices[group.id] ?? (group.selectionType === "SELECT" ? group.options[0]?.id : "");
        const option = group.options.find((entry) => entry.id === selected);
        return option
          ? {
              id: option.id,
              group: group.name,
              label: option.label,
              priceCents: option.priceCents,
              groupId: group.id,
              required: group.required,
            }
          : null;
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

  const premiumExtras = variant.extras.filter(isPremiumExtra);
  const toppingExtras = variant.extras.filter((extra) => !isPremiumExtra(extra));
  const selectedExtras = extras
    .map((id) => variant.extras.find((extra) => extra.id === id))
    .filter((extra): extra is ExtraOption => Boolean(extra));
  const pricedExtras = selectedExtras.map((extra) => ({
    priceCents: extra.priceCents,
    countsTowardIncluded: extraCountsTowardIncluded(extra.name),
  }));
  const priced = priceLine({
    basePriceCents: variant.priceCents,
    choices: selectedChoices,
    extras: pricedExtras,
    includedExtraCount: variant.includedExtraCount,
    quantity,
  });
  const missing = variant.choiceGroups.filter((group) => group.required && !selectedChoices.some((choice) => choice.groupId === group.id));
  const sideSelections = selectedChoices.filter((choice) => isSideChoiceGroup(choice.group));
  const selectedToppingIds = extras.filter((id) => toppingExtras.some((extra) => extra.id === id));

  function toppingChargeLabel(extra: ExtraOption, active: boolean) {
    if (!active) {
      if (selectedToppingIds.length < variant.includedExtraCount) return "Inkl.";
      return formatEuro(extra.priceCents);
    }
    const rank = selectedToppingIds.indexOf(extra.id);
    if (rank >= 0 && rank < variant.includedExtraCount) return "Inkl.";
    return formatEuro(extra.priceCents);
  }

  function changeVariant(next: Variant) {
    setVariantId(next.id);
    setExtras([]);
    setChoices({});
  }

  function toggleExtra(id: string) {
    setExtras((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
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
      extras: selectedExtras.map((extra) => ({
        id: extra.id,
        name: extra.name,
        priceCents: extra.priceCents,
        countsTowardIncluded: extraCountsTowardIncluded(extra.name),
      })),
      orderingEnabled: product.orderingEnabled,
    });
    toast(product.orderingEnabled ? "In den Warenkorb gelegt." : "Zur Ansicht hinzugefügt. Bestellen braucht die verbundene API.");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-end sm:place-items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-forest/40" aria-label="Dialog schließen" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-title"
        className="relative flex max-h-[78dvh] w-full flex-col rounded-t-3xl bg-cream shadow-card sm:h-auto sm:max-h-[min(86dvh,760px)] sm:max-w-2xl sm:rounded-3xl"
      >
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

          {variant.choiceGroups.map((group) => {
            const sideGroup = enhanceOffer && isSideChoiceGroup(group.name);
            return (
              <fieldset key={group.id} className="mt-5">
                <legend className="text-sm font-semibold">{group.name}</legend>
                {group.selectionType === "SELECT" && !sideGroup ? (
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
                  <div className={`mt-2 grid gap-2 ${sideGroup ? "sm:grid-cols-2" : ""}`}>
                    {group.options.map((option) => {
                      const active = (choices[group.id] ?? "") === option.id;
                      return (
                        <label
                          key={option.id}
                          className={`flex min-h-11 cursor-pointer items-start gap-3 border px-3 py-3 text-sm transition ${
                            active ? "border-brand bg-white shadow-sm" : "border-ink/10 bg-white/70"
                          }`}
                        >
                          <input
                            type="radio"
                            name={group.id}
                            className="mt-1"
                            checked={active}
                            onChange={() => setChoices((current) => ({ ...current, [group.id]: option.id }))}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium leading-snug">{option.label}</span>
                            <span className="mt-1 block text-xs text-mute">
                              {option.priceCents ? `+${formatEuro(option.priceCents)}` : enhanceOffer ? "Im Menüpreis enthalten" : "0,00 €"}
                            </span>
                          </span>
                          {active ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden /> : null}
                        </label>
                      );
                    })}
                  </div>
                )}
              </fieldset>
            );
          })}

          {variant.extras.length > 0 ? (
            <div className="mt-6 space-y-5">
              <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <h3 className="text-sm font-semibold">Extrazutaten</h3>
                {variant.includedExtraCount > 0 ? (
                  <p className="text-xs text-mute">
                    Die ersten {variant.includedExtraCount} Auflagen ab Champignons sind enthalten.
                  </p>
                ) : null}
              </div>

              {enhanceOffer && (sideSelections.length > 0 || premiumExtras.length > 0) ? (
                <div className="rounded-2xl border border-ink/10 bg-white/80 p-3 sm:p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Deine Menü-Auswahl</p>
                  <p className="mt-1 text-xs text-mute">Wird einzeln ausgewiesen und zählt nicht zu den gratis Auflagen.</p>
                  <ul className="mt-3 grid gap-2">
                    {sideSelections.map((choice) => (
                      <li
                        key={choice.id}
                        className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-brand/30 bg-cream/80 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="block text-[11px] uppercase tracking-[0.12em] text-mute">{choice.group}</span>
                          <span className="font-medium">{choice.label}</span>
                        </span>
                        <span className="shrink-0 text-mute">{choice.priceCents ? formatEuro(choice.priceCents) : "Inkl."}</span>
                      </li>
                    ))}
                    {premiumExtras.map((extra) => {
                      const active = extras.includes(extra.id);
                      return (
                        <li key={extra.id}>
                          <button
                            type="button"
                            onClick={() => toggleExtra(extra.id)}
                            className={`flex w-full min-h-11 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition ${
                              active ? "border-brand bg-cream/80" : "border-ink/10 bg-white"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block text-[11px] uppercase tracking-[0.12em] text-mute">Extra</span>
                              <span className="font-medium">{extra.name}</span>
                            </span>
                            <span className="shrink-0 text-mute">{formatEuro(extra.priceCents)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              <div>
                {enhanceOffer ? (
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-mute">Auflagen</p>
                ) : null}
                <div className="grid grid-cols-1 gap-2 sm:max-h-56 sm:grid-cols-2 sm:overflow-y-auto">
                  {(enhanceOffer ? toppingExtras : variant.extras).map((extra) => {
                    const active = extras.includes(extra.id);
                    const label = enhanceOffer
                      ? toppingChargeLabel(extra, active)
                      : extra.priceCents
                        ? formatEuro(extra.priceCents)
                        : "0,00 €";
                    return (
                      <button
                        key={extra.id}
                        type="button"
                        onClick={() => toggleExtra(extra.id)}
                        className={`flex min-h-11 items-center justify-between gap-3 border px-3 py-2 text-left text-sm ${
                          active ? "border-brand bg-white" : "border-ink/10"
                        }`}
                      >
                        <span className="min-w-0">{extra.name}</span>
                        <span className={`shrink-0 ${label === "Inkl." ? "text-brand" : "text-mute"}`}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div
          className="flex flex-col gap-3 border-t border-ink/10 bg-cream px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-7"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center self-start border border-ink/15">
            <button type="button" className="h-11 w-11" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Menge verringern">
              −
            </button>
            <span className="w-8 text-center">{quantity}</span>
            <button type="button" className="h-11 w-11" onClick={() => setQuantity((value) => value + 1)} aria-label="Menge erhöhen">
              +
            </button>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!product.available}
            className="min-h-12 w-full rounded-full bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-40 sm:w-auto"
          >
            {product.available ? `In den Warenkorb · ${formatEuro(priced.lineTotalCents)}` : "Nicht verfügbar"}
          </button>
        </div>
      </div>
    </div>
  );
}
