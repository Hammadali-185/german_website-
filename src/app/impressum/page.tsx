import type { Metadata } from "next";
import { TextPage } from "@/components/TextPage";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Platzhalter-Impressum der BISSWERK Demo.",
};

export default function ImpressumPage() {
  return (
    <TextPage title="Impressum">
      <p>
        Platzhalter für ein Impressum nach § 5 DDG. Hinter dieser Demo steht
        kein reales Unternehmen.
      </p>
      <p>
        <strong>BISSWERK Demo</strong>
        <br />
        {site.address.street}
        <br />
        {site.address.postalCode} {site.address.city}
        <br />
        {site.address.country}
      </p>
      <p>
        Telefon: <a href={site.phoneHref}>{site.phoneDisplay}</a>
        <br />
        E-Mail: <a href={site.emailHref}>{site.email}</a>
      </p>
      <p>
        Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV: Demo-Redaktion,
        Anschrift wie oben.
      </p>
      <p>
        Adresse, Telefon und E-Mail sind erfunden und lassen sich in der
        Datei für die Seitendaten austauschen.
      </p>
    </TextPage>
  );
}
