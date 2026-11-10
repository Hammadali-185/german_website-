import type { Metadata } from "next";
import { MenuBoard } from "@/components/MenuBoard";
import { menu } from "@/content/menu";

export const metadata: Metadata = {
  title: "Speisekarte",
  description:
    "Burger, Chicken, Beilagen, Getränke und Süßes bei BISSWERK. Preise in Euro, inklusive Mehrwertsteuer.",
};

export default function SpeisekartePage() {
  return <MenuBoard categories={menu} />;
}
