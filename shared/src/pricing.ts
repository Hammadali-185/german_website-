export type PricedChoice = { priceCents: number };
export type PricedExtra = { priceCents: number };

export type LinePriceInput = {
  basePriceCents: number;
  choices: PricedChoice[];
  extras: PricedExtra[];
  includedExtraCount: number;
  quantity: number;
};

export type LinePrice = {
  unitPriceCents: number;
  lineTotalCents: number;
  chargedExtraCents: number;
  freeExtraCount: number;
};

export function priceLine(input: LinePriceInput): LinePrice {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new Error("Menge muss eine ganze Zahl ab 1 sein.");
  }
  const included = Math.max(0, input.includedExtraCount);
  let chargedExtraCents = 0;
  let freeExtraCount = 0;
  input.extras.forEach((extra, index) => {
    if (index < included) {
      freeExtraCount += 1;
      return;
    }
    chargedExtraCents += extra.priceCents;
  });
  const choiceCents = input.choices.reduce((sum, choice) => sum + choice.priceCents, 0);
  const unitPriceCents = input.basePriceCents + choiceCents + chargedExtraCents;
  return {
    unitPriceCents,
    lineTotalCents: unitPriceCents * input.quantity,
    chargedExtraCents,
    freeExtraCount,
  };
}

export function cartLineKey(input: {
  productId: string;
  variantId: string;
  choiceIds: string[];
  extraIds: string[];
}): string {
  return JSON.stringify([input.productId, input.variantId, input.choiceIds, input.extraIds]);
}

export type ChoiceGroupSelection = {
  name: string;
  required: boolean;
  optionIds: string[];
};

export function assertChoiceSelection(groups: ChoiceGroupSelection[], selectedIds: string[]) {
  const known = new Set(groups.flatMap((group) => group.optionIds));
  if (selectedIds.some((id) => !known.has(id))) {
    throw new Error("Eine Auswahl gehört nicht zu diesem Produkt.");
  }
  for (const group of groups) {
    const count = group.optionIds.filter((id) => selectedIds.includes(id)).length;
    if (count > 1) throw new Error(`Bitte nur eine Auswahl für „${group.name}“.`);
    if (group.required && count !== 1) throw new Error(`Bitte „${group.name}“ auswählen.`);
  }
}

export function orderTotalCents(lineTotals: number[], deliveryFeeCents: number) {
  return lineTotals.reduce((sum, line) => sum + line, 0) + deliveryFeeCents;
}
