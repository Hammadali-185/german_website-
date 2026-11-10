/**
 * Demo menu. Prices are integer cents.
 * Photos live in public/images and are temporary placeholders.
 * Replace an image by keeping the filename, or point `image` at a new file.
 */

export type MenuTag = "Beliebt" | "Vegetarisch" | "Scharf";

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  image: string;
  imageAlt: string;
  allergens: string[];
  tags?: MenuTag[];
  featured?: boolean;
};

export type MenuCategory = {
  id: string;
  name: string;
  description: string;
  items: MenuItem[];
};

export const menu: MenuCategory[] = [
  {
    id: "burger",
    name: "Burger",
    description: "Brioche, heißes Patty, Sauce aus dem Haus.",
    items: [
      {
        id: "werkburger",
        name: "Werkburger",
        description: "Rind, Cheddar, Salat, Gurke und Tomate im Sesambrötchen.",
        priceCents: 990,
        image: "/images/werkburger.jpg",
        imageAlt: "Cheeseburger mit Salat, Tomate und Gurke im Sesambrötchen",
        allergens: ["Gluten", "Milch", "Sesam"],
        tags: ["Beliebt"],
        featured: true,
      },
      {
        id: "double-werk",
        name: "Double Werk",
        description: "Zwei Patties, Cheddar, Röstzwiebeln, Gurke und Sauce.",
        priceCents: 1390,
        image: "/images/double-werk.jpg",
        imageAlt: "Doppelter Cheeseburger mit Röstzwiebeln und Sauce",
        allergens: ["Gluten", "Milch", "Sesam", "Senf"],
      },
      {
        id: "cheese-smash",
        name: "Cheese Smash",
        description: "Dünn ausgebraten, mit viel Cheddar und Gurke.",
        priceCents: 890,
        image: "/images/cheese-smash.jpg",
        imageAlt: "Smash-Burger mit Cheddar und Gurken",
        allergens: ["Gluten", "Milch"],
      },
      {
        id: "pilzwerk",
        name: "Pilzwerk",
        description: "Gemüsepatty, Avocado, Tomate und Rucola. Ohne Fleisch.",
        priceCents: 1090,
        image: "/images/pilzwerk.jpg",
        imageAlt: "Vegetarischer Burger mit Gemüsepatty, Avocado und Rucola",
        allergens: ["Gluten", "Milch"],
        tags: ["Vegetarisch"],
      },
      {
        id: "bacon-cheese",
        name: "Bacon Cheese",
        description: "Rind, Cheddar, krosser Bacon, Salat und Tomate.",
        priceCents: 1240,
        image: "/images/bacon-cheese.jpg",
        imageAlt: "Bacon-Cheeseburger mit Salat und Tomate",
        allergens: ["Gluten", "Milch", "Sesam"],
      },
    ],
  },
  {
    id: "beilagen",
    name: "Beilagen",
    description: "Aus der Fritteuse, plus eine kalte Schale.",
    items: [
      {
        id: "pommes",
        name: "Werk-Pommes",
        description: "Dick geschnitten, mit Kräutern und geriebenem Käse.",
        priceCents: 390,
        image: "/images/pommes.jpg",
        imageAlt: "Pommes mit Kräutern und Käse im Korb",
        allergens: ["Milch"],
        tags: ["Beliebt"],
        featured: true,
      },
      {
        id: "chili-pommes",
        name: "Chili-Pommes",
        description: "Mit Paprika und etwas Chili.",
        priceCents: 450,
        image: "/images/chili-pommes.jpg",
        imageAlt: "Gewürzte Pommes auf einem Teller",
        allergens: [],
        tags: ["Scharf"],
      },
      {
        id: "onion-rings",
        name: "Onion Rings",
        description: "Zwiebelringe im Bierteig.",
        priceCents: 420,
        image: "/images/onion-rings.jpg",
        imageAlt: "Frittierte Zwiebelringe",
        allergens: ["Gluten"],
      },
      {
        id: "bunte-schale",
        name: "Bunte Schale",
        description: "Blattgemüse, Karotte, Gurke und Radieschen.",
        priceCents: 320,
        image: "/images/bunte-schale.jpg",
        imageAlt: "Bunte Gemüseschale mit Karotten, Gurke und Radieschen",
        allergens: [],
      },
    ],
  },
  {
    id: "chicken",
    name: "Chicken",
    description: "Knusprig paniert, sofort gebraten.",
    items: [
      {
        id: "crispy-filet",
        name: "Crispy Filet",
        description: "Knuspriges Hähnchen mit Krautsalat und Sauce im Brioche.",
        priceCents: 850,
        image: "/images/crispy-filet.jpg",
        imageAlt: "Hähnchenburger mit Krautsalat und Sauce",
        allergens: ["Gluten", "Eier", "Milch", "Senf"],
        tags: ["Beliebt"],
        featured: true,
      },
      {
        id: "chicken-box",
        name: "Chicken Box",
        description: "Knusprige Streifen, dazu ein Dip.",
        priceCents: 1190,
        image: "/images/chicken-box.jpg",
        imageAlt: "Knusprige Hähnchenstücke",
        allergens: ["Gluten", "Eier"],
      },
      {
        id: "hot-wings",
        name: "Hot Wings",
        description: "Scharf glasiert, mit Staudensellerie und Dip.",
        priceCents: 760,
        image: "/images/hot-wings.jpg",
        imageAlt: "Scharfe Chicken Wings mit Sellerie und Dip",
        allergens: ["Sellerie", "Milch", "Eier"],
        tags: ["Scharf"],
      },
    ],
  },
  {
    id: "getraenke",
    name: "Getränke",
    description: "Kalt, zum Burger oder für sich.",
    items: [
      {
        id: "hauslimonade",
        name: "Hauslimonade",
        description: "Zitrone, Minze und wenig Zucker.",
        priceCents: 340,
        image: "/images/hauslimonade.jpg",
        imageAlt: "Zitronenlimonade mit Minze im Glas",
        allergens: [],
      },
      {
        id: "zitronen-eistee",
        name: "Zitronen-Eistee",
        description: "Schwarzer Tee, Limette und Minze.",
        priceCents: 290,
        image: "/images/eistee.jpg",
        imageAlt: "Glas Eistee mit Limette, Minze und Eis",
        allergens: [],
      },
      {
        id: "erdbeer-shake",
        name: "Erdbeer-Shake",
        description: "Cremig, mit Erdbeeren.",
        priceCents: 490,
        image: "/images/erdbeer-shake.jpg",
        imageAlt: "Erdbeer-Milchshake im Glas",
        allergens: ["Milch"],
      },
    ],
  },
  {
    id: "suesses",
    name: "Süßes",
    description: "Wenn noch Platz ist.",
    items: [
      {
        id: "brownie",
        name: "Schoko-Brownie",
        description: "Saftig, mit dunkler Schokolade.",
        priceCents: 390,
        image: "/images/brownie.jpg",
        imageAlt: "Schokoladen-Brownie auf einem Teller",
        allergens: ["Gluten", "Eier", "Milch"],
      },
      {
        id: "eisbecher",
        name: "Vanille-Eisbecher",
        description: "Vanilleeis mit bunten Streuseln.",
        priceCents: 420,
        image: "/images/eisbecher.jpg",
        imageAlt: "Vanilleeis mit Streuseln in einer Schale",
        allergens: ["Milch"],
      },
    ],
  },
];

const featuredOrder = ["werkburger", "crispy-filet", "pommes"] as const;

export function getCategories(): { id: string; name: string }[] {
  return menu.map(({ id, name }) => ({ id, name }));
}

export function getItemById(id: string): MenuItem {
  for (const category of menu) {
    const item = category.items.find((entry) => entry.id === id);
    if (item) return item;
  }
  throw new Error(`Unbekanntes Gericht: ${id}`);
}

export function getFeaturedItems(): MenuItem[] {
  return featuredOrder.map((id) => getItemById(id));
}
