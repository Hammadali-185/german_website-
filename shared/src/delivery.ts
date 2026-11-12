export type DeliveryAreaRule = {
  id?: string;
  postalCode: string;
  locality: string;
  minimumOrderCents: number;
  deliveryFeeCents: number | null;
};

export type DeliveryDecision =
  | {
      ok: true;
      deliveryFeeCents: number;
      minimumOrderCents: number;
      area: DeliveryAreaRule | null;
    }
  | {
      ok: false;
      code: "AREA" | "MINIMUM";
      message: string;
      minimumOrderCents?: number;
      deliveryFeeCents?: number;
      area?: DeliveryAreaRule | null;
    };

export function evaluateFulfillment(input: {
  fulfillment: "DELIVERY" | "PICKUP";
  subtotalCents: number;
  area: DeliveryAreaRule | null;
  pickupMinimumCents: number;
}): DeliveryDecision {
  if (input.fulfillment === "PICKUP") {
    const minimumOrderCents = input.pickupMinimumCents;
    if (input.subtotalCents < minimumOrderCents) {
      return {
        ok: false,
        code: "MINIMUM",
        minimumOrderCents,
        deliveryFeeCents: 0,
        message: "Der Mindestbestellwert für die Abholung ist noch nicht erreicht.",
      };
    }
    return { ok: true, deliveryFeeCents: 0, minimumOrderCents, area: null };
  }

  if (!input.area) {
    return {
      ok: false,
      code: "AREA",
      message: "Diese Adresse liegt außerhalb der veröffentlichten Liefergebiete.",
    };
  }

  const deliveryFeeCents = input.area.deliveryFeeCents ?? 0;
  if (input.subtotalCents < input.area.minimumOrderCents) {
    return {
      ok: false,
      code: "MINIMUM",
      area: input.area,
      minimumOrderCents: input.area.minimumOrderCents,
      deliveryFeeCents,
      message: "Der Mindestbestellwert für dieses Liefergebiet ist noch nicht erreicht.",
    };
  }

  return {
    ok: true,
    area: input.area,
    deliveryFeeCents,
    minimumOrderCents: input.area.minimumOrderCents,
  };
}
