import type { PaymentMethod } from "@prisma/client";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http.js";
import { describePaymentMethods } from "./payment-methods.js";

export function paymentMethods() {
  return describePaymentMethods({
    paypal: Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET),
    card: Boolean(env.STRIPE_SECRET_KEY),
    sofort: Boolean(env.SOFORT_API_KEY),
  });
}

export function assertPaymentReady(method: PaymentMethod) {
  const found = paymentMethods().find((entry) => entry.method === method);
  if (!found?.available) {
    throw new HttpError(503, found?.reason ?? "Diese Zahlungsart ist nicht konfiguriert.", "PAYMENT_NOT_CONFIGURED");
  }
}
