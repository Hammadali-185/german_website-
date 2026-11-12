import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/layout/Providers";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { OpeningSequence } from "@/components/motion/OpeningSequence";
import { RouteFade } from "@/components/motion/RouteFade";
import { loadSite } from "@/lib/catalog";
import "./globals.css";

const outfit = localFont({
  src: "../fonts/outfit-latin.woff2",
  variable: "--font-outfit",
  weight: "500 700",
  display: "swap",
});
const inter = localFont({
  src: "../fonts/inter-latin.woff2",
  variable: "--font-inter",
  weight: "400 600",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: { default: "Pizza Blitz Östringen", template: "%s · Pizza Blitz" },
  description: "Pizza, Burger und italienische Spezialitäten von Toni's Pizzablitz in Östringen. Frisch zubereitet, zum Abholen oder Liefern.",
  openGraph: {
    title: "Pizza Blitz Östringen",
    description: "Frisch aus dem Ofen. Direkt zu dir.",
    locale: "de_DE",
    type: "website",
  },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await loadSite();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: site.restaurant.tradeName,
    telephone: site.restaurant.phoneInternational,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.restaurant.street,
      postalCode: site.restaurant.postalCode,
      addressLocality: site.restaurant.city,
      addressCountry: "DE",
    },
    geo: { "@type": "GeoCoordinates", latitude: site.restaurant.latitude, longitude: site.restaurant.longitude },
    servesCuisine: ["Pizza", "Italienisch", "Burger"],
    url: site.restaurant.website,
  };

  return (
    <html lang="de" className="pb-intro">
      <body className={`${outfit.variable} ${inter.variable} font-sans antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){var s=document.createElement("style");s.textContent="#pb-boot,[data-intro]{display:none!important}html.pb-intro,html.pb-intro body{overflow:auto!important}html.pb-intro body>*{visibility:visible!important}";document.head.appendChild(s);document.documentElement.classList.add("pb-skip-intro");}}catch(e){}})();`,
          }}
        />
        <div
          id="pb-boot"
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            display: "grid",
            placeItems: "center",
            background: "#12352A",
            color: "#fff",
            textAlign: "center",
            padding: "0 1.5rem",
          }}
        >
          <div>
            <img src="/images/original/logo.png" alt="" width={96} height={96} style={{ width: 96, height: 96, margin: "0 auto", display: "block" }} />
            <p style={{ margin: "1.25rem 0 0", fontFamily: "var(--font-outfit), sans-serif", fontSize: "3rem", lineHeight: 1, fontWeight: 600 }}>Pizza Blitz</p>
            <p style={{ margin: "1rem 0 0", letterSpacing: "0.28em", textTransform: "uppercase", fontSize: 12, color: "#E4B15A" }}>Frisch aus dem Ofen</p>
          </div>
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <Providers>
          <OpeningSequence />
          <SiteHeader restaurant={site.restaurant} />
          <main>
            <RouteFade>{children}</RouteFade>
          </main>
          <SiteFooter restaurant={site.restaurant} />
        </Providers>
      </body>
    </html>
  );
}
