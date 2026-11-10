import { paymentMethods, type PaymentMethodId } from "@/content/ordering";

export type Fulfillment = "lieferung" | "abholung";

export type CheckoutInput = {
  fulfillment: Fulfillment | "";
  name: string;
  phone: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  notes: string;
  payment: string;
};

export type CheckoutErrors = Partial<Record<keyof CheckoutInput, string>>;

export function validateCheckout(input: CheckoutInput): CheckoutErrors {
  const errors: CheckoutErrors = {};

  if (input.fulfillment !== "lieferung" && input.fulfillment !== "abholung") {
    errors.fulfillment = "Bitte Lieferung oder Abholung wählen.";
  }

  if (input.name.trim().length < 2) {
    errors.name = "Bitte den Namen eintragen.";
  }

  const phone = input.phone.replace(/[\s()/-]/g, "");
  if (!/^\+?[0-9]{6,15}$/.test(phone)) {
    errors.phone = "Bitte eine erreichbare Telefonnummer eintragen.";
  }

  if (input.fulfillment === "lieferung") {
    if (input.street.trim().length < 2) {
      errors.street = "Bitte die Straße eintragen.";
    }
    if (input.houseNumber.trim().length < 1) {
      errors.houseNumber = "Bitte die Hausnummer eintragen.";
    }
    if (!/^[0-9]{5}$/.test(input.postalCode.trim())) {
      errors.postalCode = "Die Postleitzahl hat fünf Ziffern.";
    }
    if (input.city.trim().length < 2) {
      errors.city = "Bitte den Ort eintragen.";
    }
  }

  if (input.notes.trim().length > 240) {
    errors.notes = "Die Notiz darf höchstens 240 Zeichen haben.";
  }

  if (!paymentMethods.some((method) => method.id === input.payment)) {
    errors.payment = "Bitte eine Zahlungsart wählen.";
  }

  return errors;
}

export function isPaymentMethod(value: string): value is PaymentMethodId {
  return paymentMethods.some((method) => method.id === value);
}

export function createOrderNumber(): string {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  const number = 1000 + (values[0] % 9000);
  return `BW-${number}`;
}
