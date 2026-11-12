import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { loadSite } from "@/lib/catalog";

export const metadata = { title: "Kasse" };

export default async function CheckoutPage() {
  const site = await loadSite();
  return <CheckoutFlow restaurant={site.restaurant} />;
}
