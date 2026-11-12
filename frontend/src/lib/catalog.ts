import { readFile } from "node:fs/promises";
import path from "node:path";
import { isRestaurantOpen, type OpeningHour } from "@pizzablitz/shared";
import type { Category, Product, Restaurant, SiteContent, Variant } from "@/types/catalog";

const backend = process.env.BACKEND_URL ?? "http://localhost:4000";
const dataDir = path.join(process.cwd(), "..", "data");

async function readJson<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(path.join(dataDir, name), "utf8")) as T;
}

function withOpen(restaurant: Omit<Restaurant, "open">): Restaurant {
  return {
    ...restaurant,
    open: isRestaurantOpen(new Date(), restaurant.hours as OpeningHour[], restaurant.holidayMode),
  };
}

function fromFileProduct(product: {
  sku: string;
  name: string;
  description: string;
  allergenCodes?: string;
  categorySlug: string;
  isOffer: boolean;
  variants: {
    label: string;
    detail: string;
    priceCents: number;
    sourcePriceId: string | null;
    includedExtraCount: number;
    sortOrder: number;
    choiceGroups: { name: string; required: boolean; selectionType: string; options: { label: string; priceCents: number }[] }[];
    extras: { sourceExtraId: string; name: string; priceCents: number }[];
  }[];
}, categories: Category[]): Product {
  const category = categories.find((entry) => entry.slug === product.categorySlug);
  const variants: Variant[] = product.variants.map((variant, index) => ({
    id: `file-${product.categorySlug}-${product.sku}-${variant.sourcePriceId ?? index}`,
    label: variant.label,
    detail: variant.detail,
    priceCents: variant.priceCents,
    includedExtraCount: variant.includedExtraCount ?? 0,
    choiceGroups: (variant.choiceGroups ?? []).map((group, groupIndex) => ({
      id: `file-${product.sku}-group-${groupIndex}`,
      name: group.name,
      required: group.required,
      selectionType: group.selectionType,
      options: group.options.map((option, optionIndex) => ({
        id: `file-${product.sku}-option-${groupIndex}-${optionIndex}`,
        label: option.label,
        priceCents: option.priceCents,
      })),
    })),
    extras: (variant.extras ?? []).map((extra) => ({
      id: `file-${product.sku}-extra-${extra.sourceExtraId}`,
      name: extra.name,
      priceCents: extra.priceCents,
    })),
  }));
  return {
    id: `file-${product.categorySlug}-${product.sku}`,
    sku: product.sku,
    name: product.name,
    description: product.description,
    allergenCodes: product.allergenCodes ?? "",
    available: true,
    isOffer: product.isOffer,
    image: category?.image ?? null,
    category: { slug: product.categorySlug, name: category?.name ?? product.categorySlug },
    fromPriceCents: Math.min(...variants.map((variant) => variant.priceCents)),
    customizable: variants.length > 1 || variants.some((variant) => variant.choiceGroups.length > 0 || variant.extras.length > 0),
    orderingEnabled: false,
    variants,
  };
}

async function loadFromFiles(): Promise<SiteContent> {
  const [restaurant, categories, products, hours] = await Promise.all([
    readJson<Omit<Restaurant, "open" | "hours" | "holidayMode"> & { announcement: Restaurant["announcement"] }>("restaurant.json"),
    readJson<Category[]>("categories.json"),
    readJson<Parameters<typeof fromFileProduct>[0][]>("products.json"),
    readJson<Restaurant["hours"]>("opening-hours.json"),
  ]);
  return {
    source: "file",
    restaurant: withOpen({ ...restaurant, holidayMode: false, hours, email: restaurant.email ?? null }),
    categories,
    products: products.map((product) => fromFileProduct(product, categories)),
  };
}

export async function loadSite(): Promise<SiteContent> {
  try {
    const [restaurantRes, categoryRes, productRes] = await Promise.all([
      fetch(`${backend}/api/restaurant`, { cache: "no-store" }),
      fetch(`${backend}/api/categories`, { cache: "no-store" }),
      fetch(`${backend}/api/products?full=true`, { cache: "no-store" }),
    ]);
    if (restaurantRes.ok && categoryRes.ok && productRes.ok) {
      const restaurant = await restaurantRes.json();
      const categories = (await categoryRes.json()) as Category[];
      const products = (await productRes.json()) as Product[];
      return {
        source: "api",
        restaurant: withOpen(restaurant),
        categories,
        products,
      };
    }
  } catch {
    // The extracted files keep the menu visible when the API is offline.
  }
  return loadFromFiles();
}

export async function loadAreas() {
  try {
    const response = await fetch(`${backend}/api/delivery/areas`, { cache: "no-store" });
    if (response.ok) return (await response.json()) as { id: string; postalCode: string; locality: string; minimumOrderCents: number; deliveryFeeCents: number | null }[];
  } catch {
    // Fall back to the extracted delivery areas.
  }
  const areas = await readJson<{ postalCode: string; locality: string; externalId: string; minimumOrderCents: number; deliveryFeeCents: number | null }[]>("delivery-areas.json");
  return areas.map((area) => ({ ...area, id: area.externalId }));
}

function cleanLegal(heading: string, content: string) {
  const withoutFooter = content.split(/Mein Konto/i)[0] ?? content;
  const first = withoutFooter.indexOf(heading);
  const second = first >= 0 ? withoutFooter.indexOf(heading, first + heading.length) : -1;
  return (second >= 0 ? withoutFooter.slice(second) : first >= 0 ? withoutFooter.slice(first) : withoutFooter).trim();
}

export async function loadLegal(page: "impressum" | "agb" | "datenschutz" | "allergene") {
  try {
    const response = await fetch(`${backend}/api/legal/${page}`, { cache: "no-store" });
    if (response.ok) return (await response.json()) as { heading: string; content: string; sourceUrl: string };
  } catch {
    // Use the extracted legal file.
  }
  const legal = await readJson<Record<string, { heading: string; content: string; sourceUrl: string }>>("legal-information.json");
  const entry = legal[page];
  return { ...entry, content: cleanLegal(entry.heading, entry.content) };
}
