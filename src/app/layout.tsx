import type { Metadata } from "next";
import { Barlow_Condensed, Outfit } from "next/font/google";
import { CartProvider } from "@/components/CartProvider";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { site } from "@/content/site";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

const display = Barlow_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "BISSWERK — Fast Food",
    template: "%s · BISSWERK",
  },
  description: site.description,
  applicationName: site.name,
  robots: { index: false, follow: false },
  openGraph: {
    title: "BISSWERK",
    description: site.description,
    locale: "de_DE",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#F3F3F0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${outfit.variable} ${display.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        <CartProvider>
          <a className="skip" href="#inhalt">
            Zum Inhalt
          </a>
          <Header />
          <main id="inhalt">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
