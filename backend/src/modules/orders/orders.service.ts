import { assertChoiceSelection, orderTotalCents, priceLine } from "@pizzablitz/shared";
import type { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../utils/http.js";
import { assertOrderAllowed } from "../delivery/delivery.service.js";
import { assertPaymentReady } from "../payments/payments.service.js";
import { cartItemSchema, orderSchema, quoteSchema } from "./orders.schema.js";

type CartItem = z.infer<typeof cartItemSchema>;

export async function priceItems(items: CartItem[]) {
  const lines = [];
  for (const item of items) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: item.variantId },
      include: {
        product: true,
        choiceGroups: { include: { options: true } },
        extraPrices: { include: { extra: true } },
      },
    });
    if (!variant || variant.productId !== item.productId) {
      throw new HttpError(400, "Eine Produktvariante ist ungültig.", "PRODUCT");
    }
    if (!variant.product.available) {
      throw new HttpError(400, `${variant.product.name} ist derzeit nicht verfügbar.`, "UNAVAILABLE");
    }

    try {
      assertChoiceSelection(
        variant.choiceGroups.map((group) => ({
          name: group.name,
          required: group.required,
          optionIds: group.options.map((option) => option.id),
        })),
        item.choiceOptionIds,
      );
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Auswahl ungültig.", "CHOICE");
    }
    const selectedChoices = variant.choiceGroups.flatMap((group) =>
      group.options
        .filter((option) => item.choiceOptionIds.includes(option.id))
        .map((option) => ({ ...option, groupName: group.name })),
    );

    const extras = item.extraIds.map((extraId) => {
      const price = variant.extraPrices.find((entry) => entry.extraId === extraId);
      if (!price) throw new HttpError(400, "Eine Extrazutat gehört nicht zu dieser Größe.", "EXTRA");
      return price;
    });
    const priced = priceLine({
      basePriceCents: variant.priceCents,
      choices: selectedChoices.map((choice) => ({ priceCents: choice.priceCents })),
      extras: extras.map((extra) => ({ priceCents: extra.priceCents })),
      includedExtraCount: variant.includedExtraCount,
      quantity: item.quantity,
    });
    lines.push({ variant, selectedChoices, extras, priced, quantity: item.quantity });
  }
  const subtotalCents = orderTotalCents(
    lines.map((line) => line.priced.lineTotalCents),
    0,
  );
  return { lines, subtotalCents };
}

export async function quoteOrder(input: z.infer<typeof quoteSchema>) {
  const priced = await priceItems(input.items);
  const allowance = await assertOrderAllowed({
    fulfillment: input.fulfillment,
    subtotalCents: priced.subtotalCents,
    deliveryAreaId: input.deliveryAreaId,
    postalCode: input.postalCode,
  });
  const deliveryFeeCents = allowance.decision.ok ? allowance.decision.deliveryFeeCents : 0;
  return {
    subtotalCents: priced.subtotalCents,
    deliveryFeeCents,
    totalCents: orderTotalCents([priced.subtotalCents], deliveryFeeCents),
    minimumOrderCents: allowance.decision.minimumOrderCents,
    lines: priced.lines.map((line) => ({
      name: line.variant.product.name,
      variantLabel: line.variant.label,
      quantity: line.quantity,
      unitPriceCents: line.priced.unitPriceCents,
      lineTotalCents: line.priced.lineTotalCents,
    })),
  };
}

export async function createOrder(input: z.infer<typeof orderSchema>, userId?: string) {
  if (input.fulfillment === "DELIVERY" && input.address.street.trim().length < 3) {
    throw new HttpError(400, "Bitte die Lieferstraße angeben.", "ADDRESS");
  }
  assertPaymentReady(input.paymentMethod);
  const priced = await priceItems(input.items);
  const allowance = await assertOrderAllowed({
    fulfillment: input.fulfillment,
    subtotalCents: priced.subtotalCents,
    deliveryAreaId: input.deliveryAreaId,
    postalCode: input.address.postalCode || input.postalCode,
  });
  if (!allowance.decision.ok) throw new HttpError(400, "Die Bestellung kann so nicht geliefert werden.", "DELIVERY");

  const order = await prisma.order.create({
    data: {
      userId,
      fulfillment: input.fulfillment,
      customerFirstName: input.customer.firstName,
      customerLastName: input.customer.lastName,
      customerEmail: input.customer.email.toLowerCase(),
      customerPhone: input.customer.phone,
      street: input.fulfillment === "DELIVERY" ? input.address.street : "",
      postalCode: input.address.postalCode,
      city: input.address.city,
      deliveryAreaId: allowance.areaId,
      notes: input.notes,
      subtotalCents: priced.subtotalCents,
      deliveryFeeCents: allowance.decision.deliveryFeeCents,
      totalCents: orderTotalCents([priced.subtotalCents], allowance.decision.deliveryFeeCents),
      minimumOrderCents: allowance.decision.minimumOrderCents,
      items: {
        create: priced.lines.map((line) => ({
          sku: line.variant.product.sku,
          productName: line.variant.product.name,
          variantLabel: line.variant.label,
          variantDetail: line.variant.detail,
          unitPriceCents: line.priced.unitPriceCents,
          quantity: line.quantity,
          lineTotalCents: line.priced.lineTotalCents,
          customizationJson: {
            choices: line.selectedChoices.map((choice) => ({
              group: choice.groupName,
              label: choice.label,
              priceCents: choice.priceCents,
            })),
            extras: line.extras.map((extra, index) => ({
              name: extra.extra.name,
              priceCents: extra.priceCents,
              included: index < line.variant.includedExtraCount,
            })),
          },
        })),
      },
      payment: {
        create: {
          method: input.paymentMethod,
          status: "UNPAID",
        },
      },
    },
    include: { items: true, payment: true, deliveryArea: true },
  });
  return order;
}

export async function getOwnOrder(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: true, payment: true, deliveryArea: true },
  });
  if (!order) throw new HttpError(404, "Bestellung nicht gefunden.", "NOT_FOUND");
  return order;
}

export async function listOwnOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    include: { items: true, payment: true },
    orderBy: { createdAt: "desc" },
  });
}
