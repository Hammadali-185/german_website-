/**
 * Replace this file to adapt BISSWERK for a real restaurant.
 * Address, phone, email and opening hours are demo placeholders.
 */
export const site = {
  name: "BISSWERK",
  tagline: "Frisch von der Platte.",
  description:
    "Burger, Crispy Chicken und Beilagen zum Mitnehmen. Demo-Website: Speisekarte, Preise, Adresse und Fotos sind Platzhalter.",
  phoneDisplay: "030 00000000",
  phoneHref: "tel:+493000000000",
  email: "hallo@bisswerk.demo",
  emailHref: "mailto:hallo@bisswerk.demo",
  address: {
    street: "Demostraße 1",
    postalCode: "10115",
    city: "Berlin",
    country: "Deutschland",
  },
  hours: [
    { days: "Montag – Donnerstag", time: "11:00 – 22:00" },
    { days: "Freitag – Samstag", time: "11:00 – 23:00" },
    { days: "Sonntag", time: "12:00 – 21:00" },
  ],
  orderSteps: [
    {
      number: "01",
      title: "Aussuchen",
      text: "Gericht öffnen und Größe, Käse, Sauce oder Belag wählen.",
    },
    {
      number: "02",
      title: "In den Warenkorb",
      text: "Menge anpassen. Der Preis rechnet sich von allein.",
    },
    {
      number: "03",
      title: "Abholen oder liefern",
      text: "An der Kasse Lieferung oder Abholung angeben. In der Demo wird nichts bezahlt.",
    },
  ],
} as const;

export function addressLine(): string {
  const { street, postalCode, city } = site.address;
  return `${street}, ${postalCode} ${city}`;
}
