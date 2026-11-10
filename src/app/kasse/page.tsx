import type { Metadata } from "next";
import { Checkout } from "@/components/Checkout";

export const metadata: Metadata = {
  title: "Kasse",
  description:
    "Demo-Kasse für BISSWERK. Lieferung oder Abholung, ohne echte Zahlung.",
};

export default function CheckoutPage() {
  return <Checkout />;
}
