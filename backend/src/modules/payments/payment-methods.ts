function onlineMethod(
  method: "PAYPAL" | "CARD" | "SOFORT",
  label: string,
  configured: boolean,
  missingReason: string,
) {
  return {
    method,
    label,
    available: false,
    reason: configured
      ? "Zugangsdaten ersetzen keine bestandene Zahlungsprüfung. Eine Zahlung wird nicht ausgeführt."
      : missingReason,
  };
}

export function describePaymentMethods(flags: { paypal: boolean; card: boolean; sofort: boolean }) {
  return [
    { method: "CASH" as const, label: "Barzahlung bei Übergabe", available: true, reason: null },
    onlineMethod("PAYPAL", "PayPal", flags.paypal, "PayPal-Zugangsdaten fehlen. Eine Zahlung wird nicht simuliert."),
    onlineMethod("CARD", "Kreditkarte", flags.card, "Kartenzahlung ist nicht konfiguriert. Eine Zahlung wird nicht simuliert."),
    onlineMethod("SOFORT", "Sofortüberweisung", flags.sofort, "Sofortüberweisung ist nicht konfiguriert. Eine Zahlung wird nicht simuliert."),
  ];
}
