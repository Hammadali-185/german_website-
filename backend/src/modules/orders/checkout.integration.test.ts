import "../../config/load-env.js";
import { berlinClock, OUTSIDE_DELIVERY_RADIUS_MESSAGE } from "@pizzablitz/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../utils/http.js";
import { presentOrder, createOrder, getOwnOrder } from "./orders.service.js";
import { restoreOpeningFixture } from "./test-hours.js";
import { orderSchema } from "./orders.schema.js";

const keys: string[] = [];

function key(name: string) {
  const value = `lifecycle-${name}-${Date.now()}`;
  keys.push(value);
  return value;
}

type OrderInput = Parameters<typeof createOrder>[0];

describe("checkout lifecycle", () => {
  let restaurant: { id: string; street: string; postalCode: string; city: string; latitude: number; longitude: number; holidayMode: boolean } | null = null;
  let previousHour: { id: string; opens: string; closes: string } | null = null;
  let createdHourId: string | null = null;
  let item: OrderInput["items"][number];
  let area: { id: string; postalCode: string };
  let unitPriceCents = 0;

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    const found = await prisma.restaurant.findFirst({ include: { hours: true } });
    if (!found) throw new Error("Restaurant ist nicht in der Datenbank.");
    restaurant = found;
    const today = berlinClock(new Date()).day;
    const currentHour = found.hours.find((hour) => hour.day === today);
    if (currentHour) {
      previousHour = { id: currentHour.id, opens: currentHour.opens, closes: currentHour.closes };
      await prisma.openingHours.update({ where: { id: currentHour.id }, data: { opens: "00:00", closes: "23:59" } });
    } else {
      const created = await prisma.openingHours.create({
        data: { restaurantId: found.id, day: today, label: today, opens: "00:00", closes: "23:59" },
      });
      createdHourId = created.id;
    }
    await prisma.restaurant.update({ where: { id: found.id }, data: { holidayMode: false } });

    const variants = await prisma.productVariant.findMany({
      where: { product: { available: true } },
      include: { product: true, choiceGroups: true },
      orderBy: { priceCents: "desc" },
    });
    const variant = variants.find((entry) => entry.choiceGroups.every((group) => !group.required)) ?? null;
    if (!variant) throw new Error("Keine bestellbare Produktvariante ohne Pflichtauswahl in der Datenbank.");
    unitPriceCents = variant.priceCents;
    const areaRow = await prisma.deliveryArea.findFirst({ where: { active: true, postalCode: "76684" } });
    if (!areaRow) throw new Error("Liefergebiet 76684 fehlt.");
    area = areaRow;
    const quantity = Math.min(50, Math.max(1, Math.ceil((areaRow.minimumOrderCents + 100) / variant.priceCents)));
    item = { productId: variant.productId, variantId: variant.id, quantity, choiceOptionIds: [], extraIds: [] };
  });

  afterAll(async () => {
    try {
      await restoreOpeningFixture({ previousHour, createdHourId, restaurant });
      if (keys.length) await prisma.order.deleteMany({ where: { idempotencyKey: { in: keys } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  function base(overrides: Record<string, unknown> = {}): OrderInput {
    return orderSchema.parse({
      fulfillment: "DELIVERY",
      idempotencyKey: key("order"),
      customer: { firstName: "Test", lastName: "Gast", email: "", phone: "07253 123456" },
      address: {
        street: "Kuhngasse 1",
        postalCode: area.postalCode,
        city: "Östringen",
        latitude: restaurant!.latitude + 0.01,
        longitude: restaurant!.longitude,
      },
      notes: "Bitte klingeln",
      paymentMethod: "CASH",
      items: [item],
      deliveryAreaId: area.id,
      postalCode: area.postalCode,
      ...overrides,
    });
  }

  it("saves a delivery inside 20 km with an empty email and cash still unpaid", async () => {
    const order = await createOrder(base());
    expect(order.customerEmail).toBeNull();
    expect(order.status).toBe("PENDING");
    expect(order.payment?.status).toBe("UNPAID");
    expect(order.payment?.method).toBe("CASH");
    expect(order.deliveryFeeCents).toBeGreaterThanOrEqual(0);
    expect(order.totalCents).toBe(unitPriceCents * item.quantity + order.deliveryFeeCents);
    expect(order.totalCents).not.toBe(1);
    expect(order.distanceKm).not.toBeNull();
    expect(order.distanceKm!).toBeLessThanOrEqual(20);
    expect(order.latitude).not.toBeNull();
    expect(order.notes).toBe("Bitte klingeln");
    expect(order.statusEvents[0]?.status).toBe("PENDING");
    const stored = await prisma.order.findUnique({ where: { id: order.id }, include: { items: true, payment: true } });
    expect(stored?.items).toHaveLength(1);
    expect(stored?.items[0]?.unitPriceCents).toBe(unitPriceCents);
    const visible = presentOrder(stored!);
    expect(visible.orderCode).toMatch(/^PB-/);
    expect(visible.customerPhone).toBe("07253 123456");
  });

  it("stores a valid email in lowercase", async () => {
    const order = await createOrder(base({ customer: { firstName: "Test", lastName: "Gast", email: "Guest@Example.com", phone: "07253 123456" } }));
    expect(order.customerEmail).toBe("guest@example.com");
  });

  it("rejects a point farther than 20 km", async () => {
    await expect(
      createOrder(
        base({
          address: { street: "Alexanderplatz", postalCode: "10178", city: "Berlin", latitude: 52.5219, longitude: 13.4132 },
          postalCode: "10178",
        }),
      ),
    ).rejects.toMatchObject({ message: OUTSIDE_DELIVERY_RADIUS_MESSAGE, code: "RADIUS" });
  });

  it("rejects a nearby point that is outside the published delivery area", async () => {
    await expect(
      createOrder(
        base({
          address: { street: "Testweg 1", postalCode: "12345", city: "Östringen", latitude: restaurant!.latitude + 0.01, longitude: restaurant!.longitude },
          postalCode: "12345",
        }),
      ),
    ).rejects.toMatchObject({ code: "AREA" });
  });

  it("stores pickup at the shop without a delivery fee", async () => {
    const order = await createOrder(
      base({
        fulfillment: "PICKUP",
        deliveryAreaId: undefined,
        postalCode: "",
        address: { street: "Ignorieren", postalCode: "00000", city: "Falsch" },
      }),
    );
    expect(order.fulfillment).toBe("PICKUP");
    expect(order.street).toBe(restaurant!.street);
    expect(order.postalCode).toBe(restaurant!.postalCode);
    expect(order.city).toBe(restaurant!.city);
    expect(order.deliveryFeeCents).toBe(0);
    expect(order.latitude).toBe(restaurant!.latitude);
    expect(order.longitude).toBe(restaurant!.longitude);
  });

  it("rejects disabled online payment methods before saving an order", async () => {
    const idempotencyKey = key("paypal");
    await expect(createOrder(base({ paymentMethod: "PAYPAL", idempotencyKey }))).rejects.toBeInstanceOf(HttpError);
    await expect(createOrder(base({ paymentMethod: "CARD", idempotencyKey: key("card") }))).rejects.toMatchObject({ code: "PAYMENT_NOT_CONFIGURED" });
    await expect(createOrder(base({ paymentMethod: "SOFORT", idempotencyKey: key("sofort") }))).rejects.toMatchObject({ code: "PAYMENT_NOT_CONFIGURED" });
    expect(await prisma.order.count({ where: { idempotencyKey } })).toBe(0);
  });

  it("returns the same order when checkout is submitted twice", async () => {
    const idempotencyKey = key("duplicate");
    const input = base({ idempotencyKey });
    const first = await createOrder(input);
    const second = await createOrder(input);
    expect(second.id).toBe(first.id);
    expect(second.publicNumber).toBe(first.publicNumber);
    expect(await prisma.order.count({ where: { idempotencyKey } })).toBe(1);
  });

  it("does not let another customer read the order", async () => {
    const order = await createOrder(base());
    const stranger = await prisma.user.create({
      data: { email: `${key("user")}@example.com`, passwordHash: "not-a-login", firstName: "Fremd", lastName: "Gast" },
    });
    await expect(getOwnOrder(stranger.id, order.id)).rejects.toMatchObject({ status: 404 });
    await prisma.user.delete({ where: { id: stranger.id } });
  });
});
