import { getItemById, type MenuItem } from "@/content/menu";

/**
 * Extra prices, portions and demo fees.
 * Base dish prices stay in menu.ts. Both files are the replaceable catalog.
 */

export type Choice = {
  id: string;
  name: string;
  priceCents: number;
};

export type OptionGroup = {
  id: string;
  name: string;
  mode: "single" | "multiple";
  choices: Choice[];
};

const sizeNormalLarge = (largeCents: number): OptionGroup => ({
  id: "groesse",
  name: "Größe",
  mode: "single",
  choices: [
    { id: "normal", name: "Normal", priceCents: 0 },
    { id: "gross", name: "Groß", priceCents: largeCents },
  ],
});

const drinkSize: OptionGroup = {
  id: "groesse",
  name: "Größe",
  mode: "single",
  choices: [
    { id: "03", name: "0,3 l", priceCents: 0 },
    { id: "05", name: "0,5 l", priceCents: 90 },
  ],
};

const wingPortion: OptionGroup = {
  id: "groesse",
  name: "Portion",
  mode: "single",
  choices: [
    { id: "sechs", name: "6 Stück", priceCents: 0 },
    { id: "neun", name: "9 Stück", priceCents: 340 },
  ],
};

const extraCheese: OptionGroup = {
  id: "kaese",
  name: "Käse",
  mode: "single",
  choices: [
    { id: "standard", name: "Wie auf der Karte", priceCents: 0 },
    { id: "extra", name: "Extra Käse", priceCents: 100 },
  ],
};

const extraSauce: OptionGroup = {
  id: "sauce",
  name: "Sauce",
  mode: "single",
  choices: [
    { id: "standard", name: "Wie auf der Karte", priceCents: 0 },
    { id: "extra", name: "Extra Sauce", priceCents: 70 },
  ],
};

const sweetSauce: OptionGroup = {
  id: "sauce",
  name: "Sauce",
  mode: "single",
  choices: [
    { id: "standard", name: "Wie auf der Karte", priceCents: 0 },
    { id: "schoko", name: "Extra Schokoladensauce", priceCents: 80 },
  ],
};

const toppings: OptionGroup = {
  id: "belag",
  name: "Extra Belag",
  mode: "multiple",
  choices: [
    { id: "bacon", name: "Bacon", priceCents: 150 },
    { id: "rostzwiebeln", name: "Röstzwiebeln", priceCents: 60 },
    { id: "jalapenos", name: "Jalapeños", priceCents: 80 },
    { id: "gurken", name: "Extra Gurken", priceCents: 50 },
  ],
};

const toppingsWithoutBacon: OptionGroup = {
  ...toppings,
  choices: toppings.choices.filter((choice) => choice.id !== "bacon"),
};

const profiles = {
  burger: [sizeNormalLarge(200), extraCheese, extraSauce, toppings],
  "burger-veg": [sizeNormalLarge(200), extraCheese, extraSauce, toppingsWithoutBacon],
  side: [sizeNormalLarge(150), extraCheese, extraSauce],
  box: [sizeNormalLarge(300), extraSauce],
  wings: [wingPortion, extraSauce],
  drink: [drinkSize],
  sweet: [sweetSauce],
  plain: [],
} as const satisfies Record<string, OptionGroup[]>;

type ProfileId = keyof typeof profiles;

const itemProfiles: Record<string, ProfileId> = {
  werkburger: "burger",
  "double-werk": "burger",
  "cheese-smash": "burger",
  pilzwerk: "burger-veg",
  "bacon-cheese": "burger",
  pommes: "side",
  "chili-pommes": "side",
  "onion-rings": "side",
  "bunte-schale": "plain",
  "crispy-filet": "burger",
  "chicken-box": "box",
  "hot-wings": "wings",
  hauslimonade: "drink",
  "zitronen-eistee": "drink",
  "erdbeer-shake": "drink",
  brownie: "sweet",
  eisbecher: "sweet",
};

export const fees = {
  deliveryCents: 250,
  pickupCents: 0,
} as const;

export const paymentMethods = [
  {
    id: "bar",
    name: "Bar bei Übergabe",
    detail: "Demo. Es wird nichts kassiert.",
  },
  {
    id: "karte",
    name: "Karte am Gerät",
    detail: "Demo. Es wird nichts abgebucht.",
  },
  {
    id: "online",
    name: "Online bezahlen",
    detail: "Demo. Kein Zahlungsdienst.",
  },
] as const;

export type PaymentMethodId = (typeof paymentMethods)[number]["id"];

export type CartSelection = Record<string, string[]>;

export function getOptionGroups(item: MenuItem): OptionGroup[] {
  const profile = itemProfiles[item.id] ?? "plain";
  return profiles[profile];
}

export function defaultSelection(groups: OptionGroup[]): CartSelection {
  const selection: CartSelection = {};
  for (const group of groups) {
    selection[group.id] = group.mode === "single" ? [group.choices[0].id] : [];
  }
  return selection;
}

export function unitPriceCents(itemId: string, selection: CartSelection): number {
  const item = getItemById(itemId);
  let cents = item.priceCents;
  for (const group of getOptionGroups(item)) {
    const chosen = selection[group.id] ?? [];
    for (const choiceId of chosen) {
      const choice = group.choices.find((entry) => entry.id === choiceId);
      if (choice) cents += choice.priceCents;
    }
  }
  return cents;
}

export function selectionLabels(item: MenuItem, selection: CartSelection): string[] {
  const labels: string[] = [];
  for (const group of getOptionGroups(item)) {
    for (const choiceId of selection[group.id] ?? []) {
      const choice = group.choices.find((entry) => entry.id === choiceId);
      if (!choice) continue;
      const isDefault =
        group.mode === "single" &&
        choice.priceCents === 0 &&
        group.choices[0]?.id === choice.id &&
        group.id !== "groesse";
      if (!isDefault) labels.push(choice.name);
    }
  }
  return labels;
}

export function makeLineId(
  itemId: string,
  selection: CartSelection,
  note: string,
): string {
  const groups = Object.keys(selection).sort();
  const body = groups
    .map((groupId) => `${groupId}:${[...selection[groupId]].sort().join("+")}`)
    .join("|");
  return `${itemId}::${body}::${note.trim().toLowerCase()}`;
}
