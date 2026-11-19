import { paymentMethods } from "../payments/payments.service.js";

const methods = () => paymentMethods();

export function systemStatus() {
  const payments = methods();
  const online = payments.filter((method) => method.method !== "CASH");
  return {
    extensions: [
      { id: "orders", name: "Bestellungen", state: "installed", description: "Echte Bestellungen mit Status und serverseitiger Preisberechnung." },
      { id: "deliveries", name: "Lieferungen", state: "installed", description: "Lieferwarteschlangen und Gebühren ohne Abholungen." },
      { id: "catalog", name: "Katalog", state: "installed", description: "Produkte, Kategorien, Varianten und Extras. Bilder nur als Adresse, kein Datei-Upload." },
      { id: "customers", name: "Kunden", state: "installed", description: "Zusammenfassung vorhandener Bestellungen. Es werden keine Kunden erfunden." },
      { id: "reports", name: "Berichte", state: "installed", description: "Umsatz, kassierte und unbezahlte Beträge aus PostgreSQL." },
      { id: "coupons", name: "Gutscheine", state: "installed", description: "Codes werden beim Checkout auf dem Server geprüft und in der Bestellung festgehalten." },
      { id: "offers", name: "Angebote", state: "installed", description: "Vorhandene Angebotsprodukte und die phone-gift-Ankündigung." },
      { id: "email", name: "E-Mail und SMS", state: "unavailable", description: "Es wird keine Nachricht versendet." },
      { id: "uploads", name: "Bild-Upload", state: "unavailable", description: "Dateien werden nicht angenommen." },
      { id: "tracking", name: "Fahrerortung", state: "unavailable", description: "Es gibt keine Live-Position eines Fahrers." },
    ],
    connections: [
      { id: "cash", name: "Barzahlung", state: "active", description: "Bestellungen starten als unbezahlt. Die Kasse markiert eine Barzahlung erst, wenn das Geld tatsächlich angenommen wurde." },
      { id: "socket", name: "Socket.IO", state: "active", description: "Der API-Server stellt Socket.IO für Bestellereignisse bereit. Das ist kein dauerhaft geöffneter Admin-Browser." },
      { id: "address", name: "Adresssuche", state: "active", description: "Vorschläge kommen von Photon. Eine eigene Kartenintegration ist nicht angeschlossen." },
      ...online.map((method) => ({
        id: method.method.toLowerCase(),
        name: method.label,
        state: "unavailable" as const,
        description: method.available
          ? "Zugangsdaten sind gesetzt, aber es gibt keine bestandene Zahlungsprüfung. Die Methode wird hier nicht als verbunden angezeigt."
          : method.reason ?? "Nicht konfiguriert.",
      })),
    ],
  };
}
