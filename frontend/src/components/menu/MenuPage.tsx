import { MenuExperience } from "@/components/menu/MenuExperience";
import { loadSite } from "@/lib/catalog";

export const metadata = { title: "Speisekarte" };

export async function MenuPage({ initialCategory }: { initialCategory?: string }) {
  const site = await loadSite();
  return <MenuExperience products={site.products} categories={site.categories} initialCategory={initialCategory} />;
}

export default MenuPage;
