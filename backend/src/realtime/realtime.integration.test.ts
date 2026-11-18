import "../config/load-env.js";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { prisma } from "../database/prisma.js";
import { createApp } from "../app.js";
import { orderSchema } from "../modules/orders/orders.schema.js";
import { createOrder, getOrderByTrackingToken, updateOrderStatus } from "../modules/orders/orders.service.js";
import { issueTicket } from "./access.js";
import { publishPending } from "./publish.js";
import { attachRealtime } from "./server.js";

const keys: string[] = [];
const startedAt = new Date();

function key(name: string) {
  const value = `live-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  keys.push(value);
  return value;
}

function waitFor<T>(socket: Socket, event: string, timeout = 4000) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Keine Nachricht ${event}`)), timeout);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe("realtime orders", () => {
  let url = "";
  let closeServer: () => Promise<void> = async () => undefined;
  let restaurant: { id: string; holidayMode: boolean } | null = null;
  let previousHour: { id: string; opens: string; closes: string } | null = null;
  let createdHourId: string | null = null;
  let item: { productId: string; variantId: string; quantity: number; choiceOptionIds: string[]; extraIds: string[] };
  let strangerId = "";

  beforeAll(async () => {
    const app = createApp();
    const server = createServer(app);
    attachRealtime(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    url = `http://127.0.0.1:${address.port}`;
    closeServer = () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      });

    const found = await prisma.restaurant.findFirst({ include: { hours: true } });
    if (!found) throw new Error("Restaurant fehlt.");
    restaurant = found;
    const wednesday = found.hours.find((hour) => hour.day === "WEDNESDAY");
    if (wednesday) {
      previousHour = wednesday;
      await prisma.openingHours.update({ where: { id: wednesday.id }, data: { opens: "00:00", closes: "23:59" } });
    } else {
      const created = await prisma.openingHours.create({
        data: { restaurantId: found.id, day: "WEDNESDAY", label: "Mittwoch", opens: "00:00", closes: "23:59" },
      });
      createdHourId = created.id;
    }
    await prisma.restaurant.update({ where: { id: found.id }, data: { holidayMode: false } });
    const variants = await prisma.productVariant.findMany({
      where: { product: { available: true } },
      include: { choiceGroups: true },
      orderBy: { priceCents: "asc" },
    });
    const variant = variants.find((entry) => entry.choiceGroups.every((group) => !group.required));
    if (!variant) throw new Error("Keine Variante ohne Pflichtauswahl.");
    item = { productId: variant.productId, variantId: variant.id, quantity: 1, choiceOptionIds: [], extraIds: [] };
  });

  afterAll(async () => {
    await closeServer();
    if (keys.length) await prisma.order.deleteMany({ where: { idempotencyKey: { in: keys } } });
    await prisma.realtimeOutbox.deleteMany({ where: { createdAt: { gte: startedAt } } });
    await prisma.realtimeTicket.deleteMany({ where: { createdAt: { gte: startedAt } } });
    if (strangerId) await prisma.user.delete({ where: { id: strangerId } }).catch(() => undefined);
    if (previousHour) {
      await prisma.openingHours.update({ where: { id: previousHour.id }, data: { opens: previousHour.opens, closes: previousHour.closes } });
    }
    if (createdHourId) await prisma.openingHours.delete({ where: { id: createdHourId } });
    if (restaurant) await prisma.restaurant.update({ where: { id: restaurant.id }, data: { holidayMode: restaurant.holidayMode } });
    await prisma.$disconnect();
  });

  function pickup(name: string) {
    return orderSchema.parse({
      fulfillment: "PICKUP",
      idempotencyKey: key(name),
      customer: { firstName: "Live", lastName: name, email: "", phone: "07253 123456" },
      address: {},
      notes: "",
      paymentMethod: "CASH",
      items: [item],
    });
  }

  it("shows a new order to the admin and the status only to that customer", async () => {
    const adminUser = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    const stranger = await prisma.user.create({
      data: { email: `${key("stranger")}@example.com`, passwordHash: "not-a-login", firstName: "Fremd", lastName: "Gast" },
    });
    strangerId = stranger.id;
    const admin = io(url, { auth: { ticket: (await issueTicket(adminUser.id)).token }, reconnection: false, transports: ["websocket"] });
    const other = io(url, { auth: { ticket: (await issueTicket(stranger.id)).token }, reconnection: false, transports: ["websocket"] });
    await Promise.all([waitFor(admin, "connect"), waitFor(other, "connect")]);

    let leaked = false;
    other.on("order:new", () => {
      leaked = true;
    });
    const created = waitFor<{ eventId: string; order: { id: string; publicNumber: number } }>(admin, "order:new");
    const first = await createOrder(pickup("one"));
    const event = await created;
    expect(event.order.publicNumber).toBe(first.publicNumber);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(leaked).toBe(false);
    let duplicate = false;
    admin.once("order:new", () => {
      duplicate = true;
    });
    await publishPending();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(duplicate).toBe(false);
    const second = await createOrder(pickup("two"));

    const guest = io(url, { auth: { trackingToken: first.trackingToken }, reconnection: false, transports: ["websocket"] });
    const otherGuest = io(url, { auth: { trackingToken: second.trackingToken }, reconnection: false, transports: ["websocket"] });
    await Promise.all([waitFor(guest, "connect"), waitFor(otherGuest, "connect")]);
    expect(await guest.emitWithAck("order:watch", { orderId: second.id, trackingToken: first.trackingToken })).toEqual({ ok: false });
    expect(await other.emitWithAck("admin:join")).toEqual({ ok: false });
    expect(await other.emitWithAck("order:watch", { orderId: first.id })).toEqual({ ok: false });

    const status = waitFor<{ orderId: string; status: string; eventId: string }>(guest, "order:status");
    const otherStatus = waitFor(otherGuest, "order:status", 500).then(
      () => true,
      () => false,
    );
    await updateOrderStatus(first.id, "ACCEPTED");
    expect(await status).toMatchObject({ orderId: first.id, status: "ACCEPTED" });
    expect(await otherStatus).toBe(false);

    guest.disconnect();
    await updateOrderStatus(first.id, "PREPARING");
    guest.connect();
    await waitFor(guest, "connect");
    expect((await getOrderByTrackingToken(first.trackingToken!)).status).toBe("PREPARING");
    const afterReconnect = waitFor<{ status: string }>(guest, "order:status");
    await updateOrderStatus(first.id, "READY_FOR_PICKUP");
    expect(await afterReconnect).toMatchObject({ status: "READY_FOR_PICKUP" });

    const bad = io(url, { auth: { trackingToken: "definitely-not-a-real-token" }, reconnection: false, transports: ["websocket"] });
    await new Promise<void>((resolve, reject) => {
      bad.on("connect", () => reject(new Error("Fremdes Token wurde akzeptiert.")));
      bad.on("connect_error", () => resolve());
    });

    admin.disconnect();
    other.disconnect();
    guest.disconnect();
    otherGuest.disconnect();
    bad.disconnect();
  });

  it("recovers an unpublished event and ignores a failed order", async () => {
    const before = await prisma.realtimeOutbox.count();
    await expect(
      createOrder({
        ...pickup("bad"),
        items: [{ productId: "missing", variantId: "missing", quantity: 1, choiceOptionIds: [], extraIds: [] }],
      }),
    ).rejects.toThrow();
    expect(await prisma.realtimeOutbox.count()).toBe(before);

    const adminUser = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    const admin = io(url, { auth: { ticket: (await issueTicket(adminUser.id)).token }, reconnection: false, transports: ["websocket"] });
    await waitFor(admin, "connect");
    const order = await createOrder(pickup("recover"));
    await prisma.realtimeOutbox.create({
      data: {
        type: "order.status",
        payload: {
          eventId: key("event"),
          orderId: order.id,
          userId: null,
          status: "CANCELLED",
          fulfillment: "PICKUP",
          publicNumber: order.publicNumber,
        },
      },
    });
    const guest = io(url, { auth: { trackingToken: order.trackingToken }, reconnection: false, transports: ["websocket"] });
    await waitFor(guest, "connect");
    const recovered = waitFor<{ status: string }>(guest, "order:status");
    await publishPending();
    expect(await recovered).toMatchObject({ status: "CANCELLED" });
    admin.disconnect();
    guest.disconnect();
  });
});
