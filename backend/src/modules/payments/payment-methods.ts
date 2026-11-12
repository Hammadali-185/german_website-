export function describePaymentMethods(flags: { paypal: boolean; card: boolean; sofort: boolean }) {
  return [
    { method: "CASH" as const, label: "Barzahlung bei Übergabe", available: true, reason: null },
    {
      method: "PAYPAL" as const,
      label: "PayPal",
      available: flags.paypal,
      reason: "PayPal-Zugangsdaten fehlen. Eine Zahlung wird nicht simuliert.",
    },
    {
      method: "CARD" as const,
      label: "Kreditkarte",
      available: flags.card,
      reason: "Kartenzahlung ist nicht konfiguriert. Eine Zahlung wird nicht simuliert.",
    },
    {
      method: "SOFORT" as const,
      label: "Sofortüberweisung",
      available: flags.sofort,
      reason: "Sofortüberweisung ist nicht konfiguriert. Eine Zahlung wird nicht simuliert.",
    },
  ];
}
