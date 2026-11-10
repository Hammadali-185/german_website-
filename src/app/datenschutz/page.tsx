import type { Metadata } from "next";
import { TextPage } from "@/components/TextPage";

export const metadata: Metadata = {
  title: "Datenschutz",
  description: "Kurzer Datenschutzhinweis der BISSWERK Demo.",
};

export default function DatenschutzPage() {
  return (
    <TextPage title="Datenschutz">
      <p>
        Kurzüberblick für diese Demo. Das ist keine Rechtsberatung und kein
        vollständiges Muster für eine Datenschutzerklärung.
      </p>
      <h2>Was diese Website tut</h2>
      <p>
        Die Seiten zeigen Speisekarte, Warenkorb und eine Demo-Kasse. Es gibt
        kein Benutzerkonto und keine Analyse-Tools. Was du in der Kasse
        einträgst, bleibt in diesem Browser und wird nicht an ein Lokal oder
        einen Zahlungsdienst geschickt.
      </p>
      <h2>Verbindung</h2>
      <p>
        Beim Aufruf kann der Hoster technisch bedingt Verbindungsdaten
        verarbeiten, etwa IP-Adresse und Zeitpunkt. In dieser Demo werden
        daraus keine Profile gebaut.
      </p>
      <h2>Schrift</h2>
      <p>
        Die Schriften werden mit der Website ausgeliefert. Der Browser lädt
        sie nicht von einem externen Schriftdienst.
      </p>
      <h2>Kontakt</h2>
      <p>
        Telefonnummer und E-Mail-Adresse sind Platzhalter und nehmen keine
        Nachrichten für ein echtes Lokal entgegen.
      </p>
    </TextPage>
  );
}
