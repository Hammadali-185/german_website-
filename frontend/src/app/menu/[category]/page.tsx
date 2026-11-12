import { MenuPage } from "@/components/menu/MenuPage";

export default async function Page({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  return <MenuPage initialCategory={decodeURIComponent(category)} />;
}
