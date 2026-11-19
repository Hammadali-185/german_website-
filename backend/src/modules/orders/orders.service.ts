import { assertChoiceSelection, customerStatusMessage, orderCode, orderTotalCents, priceLine } from "@pizzablitz/shared";
import { Prisma, type OrderStatus } from "@prisma/client";
import type { z } from "zod";
import { randomUUID } from "node:crypto";
import { prisma } from "../../database/prisma.js";
import { schedulePublish } from "../../realtime/publish.js";
import { HttpError } from "../../utils/http.js";
import { hashToken, newToken } from "../../utils/password.js";
import { assertOrderAllowed } from "../delivery/delivery.service.js";
import { promisedAtFor } from "./promise.js";
import { quoteCoupon, reserveCoupon } from "../admin/coupons.service.js";
import { assertPaymentReady } from "../payments/payments.service.js";
import { cartItemSchema, orderSchema, quoteSchema } from "./orders.schema.js";

type CartItem = z.infer<typeof cartItemSchema>;

const orderInclude = {
  items: true,
  payment: true,
  deliveryArea: true,
  statusEvents: { orderBy: { createdAt: "asc" as const } },
};

export function presentOrder<T extends { publicNumber: number; trackingTokenHash?: string | null }>(order: T) {
  const rest = { ...order };
  delete rest.trackingTokenHash;
  return { ...rest, orderCode: orderCode(order.publicNumber) };
}

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
    latitude: input.latitude,
    longitude: input.longitude,
  });
  const deliveryFeeCents = allowance.decision.ok ? allowance.decision.deliveryFeeCents : 0;
  const coupon = await quoteCoupon(input.couponCode, priced.subtotalCents);
  const totalCents = priced.subtotalCents - coupon.discountCents + deliveryFeeCents;
  return {
    subtotalCents: priced.subtotalCents,
    discountCents: coupon.discountCents,
    couponCode: coupon.couponCode,
    couponSummary: coupon.couponSummary,
    deliveryFeeCents,
    distanceKm: allowance.distanceKm,
    totalCents,
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
  const latitude = input.address.latitude ?? input.latitude;
  const longitude = input.address.longitude ?? input.longitude;
  const allowance = await assertOrderAllowed({
    fulfillment: input.fulfillment,
    subtotalCents: priced.subtotalCents,
    deliveryAreaId: input.deliveryAreaId,
    postalCode: input.address.postalCode || input.postalCode,
    latitude,
    longitude,
  });
  if (!allowance.decision.ok) throw new HttpError(400, "Die Bestellung kann so nicht geliefert werden.", "DELIVERY");

  const restaurant = await prisma.restaurant.findFirst();
  if (input.fulfillment === "PICKUP" && !restaurant) {
    throw new HttpError(503, "Restaurantdaten sind noch nicht geladen.", "NOT_READY");
  }
  const promisedAt = restaurant
    ? promisedAtFor({
        createdAt: new Date(),
        fulfillment: input.fulfillment,
        distanceKm: allowance.distanceKm,
        preparationMinutes: restaurant.preparationMinutes,
        deliveryMinutesPerKm: restaurant.deliveryMinutesPerKm,
      })
    : null;
  const trackingToken = newToken();

  try {
    const order = await prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const existing = await tx.order.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: orderInclude,
        });
        if (existing) return existing;
      }
      const coupon = input.couponCode?.trim()
        ? await reserveCoupon(tx, {
            code: input.couponCode,
            subtotalCents: priced.subtotalCents,
            userId,
            phone: input.customer.phone,
            email: input.customer.email,
          })
        : null;
      const discountCents = coupon?.discountCents ?? 0;
      const totalCents = priced.subtotalCents - discountCents + allowance.decision.deliveryFeeCents;
      if (totalCents < 0) throw new HttpError(400, "Der Gutschein macht die Bestellung ungültig.", "COUPON");

      const created = await tx.order.create({
        data: {
          userId,
          idempotencyKey: input.idempotencyKey,
          trackingTokenHash: hashToken(trackingToken),
          fulfillment: input.fulfillment,
          customerFirstName: input.customer.firstName,
          customerLastName: input.customer.lastName,
          customerEmail: input.customer.email ? input.customer.email.toLowerCase() : null,
          customerPhone: input.customer.phone,
          street: input.fulfillment === "DELIVERY" ? input.address.street : restaurant!.street,
          postalCode: input.fulfillment === "DELIVERY" ? input.address.postalCode : restaurant!.postalCode,
          city: input.fulfillment === "DELIVERY" ? input.address.city : restaurant!.city,
          latitude: input.fulfillment === "DELIVERY" ? latitude ?? null : restaurant!.latitude,
          longitude: input.fulfillment === "DELIVERY" ? longitude ?? null : restaurant!.longitude,
          distanceKm: allowance.distanceKm,
          deliveryAreaId: allowance.areaId,
          notes: input.notes,
          subtotalCents: priced.subtotalCents,
          discountCents,
          couponCode: coupon?.couponCode ?? null,
          couponSummary: coupon?.couponSummary ?? null,
          deliveryFeeCents: allowance.decision.deliveryFeeCents,
          totalCents,
          minimumOrderCents: allowance.decision.minimumOrderCents,
          promisedAt,
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
          ...(coupon
            ? {
                couponRedemption: {
                  create: {
                    couponId: coupon.couponId,
                    codeSnapshot: coupon.couponCode,
                    summary: coupon.couponSummary,
                    discountCents: coupon.discountCents,
                    customerKey: coupon.customerKey,
                  },
                },
              }
            : {}),
          statusEvents: { create: { status: "PENDING" } },
        },
        include: orderInclude,
      });

      const code = orderCode(created.publicNumber);
      await tx.notification.create({
        data: {
          audience: "ADMIN",
          orderId: created.id,
          title: `Neue Bestellung ${code}`,
          body: `${created.customerFirstName} ${created.customerLastName} · ${created.customerPhone}`,
        },
      });
      if (userId) {
        await tx.notification.create({
          data: {
            audience: "CUSTOMER",
            userId,
            orderId: created.id,
            title: `Bestellung ${code}`,
            body: customerStatusMessage("PENDING", created.fulfillment),
          },
        });
      }
      await tx.realtimeOutbox.create({
        data: {
          type: "order.created",
          payload: JSON.parse(JSON.stringify({ eventId: randomUUID(), order: presentOrder(created) })),
        },
      });
      return created;
    });

    const duplicate = Boolean(input.idempotencyKey && order.trackingTokenHash !== hashToken(trackingToken));
    if (!duplicate) schedulePublish();
    return { ...presentOrder(order), trackingToken: duplicate ? undefined : trackingToken };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && input.idempotencyKey) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: orderInclude,
      });
      if (existing) return { ...presentOrder(existing), trackingToken: undefined };
    }
    throw error;
  }
}

export async function collectCashPayment(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
  if (!order || !order.payment) throw new HttpError(404, "Bestellung nicht gefunden.", "NOT_FOUND");
  if (order.payment.method !== "CASH") throw new HttpError(409, "Nur Barzahlung kann hier als kassiert markiert werden.", "CASH_ONLY");
  if (order.status === "REJECTED" || order.status === "CANCELLED") {
    throw new HttpError(409, "Abgelehnte oder stornierte Bestellungen werden nicht kassiert.", "ORDER_CLOSED");
  }
  if (order.payment.status === "PAID") {
    const current = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
    if (!current) throw new HttpError(404, "Bestellung nicht gefunden.", "NOT_FOUND");
    return presentOrder(current);
  }
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { payment: { update: { status: "PAID", paidAt: new Date() } } },
    include: orderInclude,
  });
  return presentOrder(updated);
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) throw new HttpError(404, "Bestellung nicht gefunden.", "NOT_FOUND");
  if (existing.status === status) {
    const current = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
    if (!current) throw new HttpError(404, "Bestellung nicht gefunden.", "NOT_FOUND");
    return presentOrder(current);
  }

  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status,
        statusEvents: { create: { status } },
      },
      include: orderInclude,
    });
    if (existing.userId) {
      await tx.notification.create({
        data: {
          audience: "CUSTOMER",
          userId: existing.userId,
          orderId: updated.id,
          title: `Bestellung ${orderCode(updated.publicNumber)}`,
          body: customerStatusMessage(status, updated.fulfillment),
        },
      });
    }
    await tx.realtimeOutbox.create({
      data: {
        type: "order.status",
        payload: {
          eventId: randomUUID(),
          orderId: updated.id,
          userId: updated.userId,
          status: updated.status,
          fulfillment: updated.fulfillment,
          publicNumber: updated.publicNumber,
        },
      },
    });
    return updated;
  });
  schedulePublish();
  return presentOrder(order);
}

export async function getOwnOrder(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: orderInclude,
  });
  if (!order) throw new HttpError(404, "Bestellung nicht gefunden.", "NOT_FOUND");
  return presentOrder(order);
}

export async function listOwnOrders(userId: string) {
  const orders = await prisma.order.findMany({
    where: { userId },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });
  return orders.map((order) => presentOrder(order));
}

export async function getOrderByTrackingToken(token: string) {
  const order = await prisma.order.findUnique({
    where: { trackingTokenHash: hashToken(token) },
    include: orderInclude,
  });
  if (!order) throw new HttpError(404, "Bestellung nicht gefunden.", "NOT_FOUND");
  return presentOrder(order);
}
