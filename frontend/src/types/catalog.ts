export type Hour = { id?: string; day: string; label: string; opens: string; closes: string };

export type Announcement = {
  slug?: string;
  title: string;
  body: string;
  active: boolean;
  phoneOnly: boolean;
  minimumOrderCents: number | null;
};

export type Restaurant = {
  publicName: string;
  tradeName: string;
  legalName: string;
  ownerName: string;
  street: string;
  postalCode: string;
  city: string;
  phone: string;
  phoneInternational: string;
  fax: string;
  faxInternational: string;
  email: string | null;
  facebookUrl: string | null;
  website: string;
  latitude: number;
  longitude: number;
  logo: string;
  yearsClaim: string;
  timezone: string;
  pickupMinimumCents: number;
  holidayMode: boolean;
  hours: Hour[];
  announcement: Announcement | null;
  open: boolean;
};

export type Category = {
  id?: string;
  slug: string;
  name: string;
  image: string | null;
  sortOrder: number;
  publishedCount?: number;
};

export type ChoiceGroup = {
  id: string;
  name: string;
  required: boolean;
  selectionType: string;
  options: { id: string; label: string; priceCents: number }[];
};

export type ExtraOption = { id: string; name: string; priceCents: number };

export type Variant = {
  id: string;
  label: string;
  detail: string;
  priceCents: number;
  includedExtraCount: number;
  choiceGroups: ChoiceGroup[];
  extras: ExtraOption[];
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  allergenCodes: string;
  available: boolean;
  isOffer: boolean;
  image: string | null;
  category: { slug: string; name: string };
  fromPriceCents: number;
  customizable: boolean;
  orderingEnabled: boolean;
  variants: Variant[];
};

export type SiteContent = {
  source: "api" | "file";
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
};
