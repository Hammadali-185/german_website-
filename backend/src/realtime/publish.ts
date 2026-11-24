import type { Server } from "socket.io";
import { prisma } from "../database/prisma.js";

type CreatedPayload = { eventId: string; order: { id: string } };
type StatusPayload = {
  eventId: string;
  orderId: string;
  userId?: string | null;
  status: string;
  fulfillment: string;
  publicNumber: number;
};

let io: Server | null = null;
let publishing = false;

export function bindRealtimeServer(server: Server) {
  io = server;
}

export function schedulePublish() {
  void publishPending();
}

export async function publishPending() {
  if (!io || publishing) return;
  publishing = true;
  try {
    const rows = await prisma.realtimeOutbox.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    for (const row of rows) {
      try {
        deliver(row.type, row.payload);
        await prisma.realtimeOutbox.update({ where: { id: row.id }, data: { publishedAt: new Date() } });
      } catch (error) {
        console.error("Realtime event was not delivered and will be retried.", row.id);
        console.error(error);
        break;
      }
    }
  } finally {
    publishing = false;
  }
}

function deliver(type: string, payload: unknown) {
  if (!io) throw new Error("Realtime server is not ready.");
  if (type === "order.created") {
    const body = payload as CreatedPayload;
    io.to("admin").emit("order:new", body);
    return;
  }
  if (type === "order.status") {
    const body = payload as StatusPayload;
    const event = {
      eventId: body.eventId,
      orderId: body.orderId,
      status: body.status,
      fulfillment: body.fulfillment,
      publicNumber: body.publicNumber,
    };
    io.to(`order:${body.orderId}`).emit("order:status", event);
    if (body.userId) io.to(`user:${body.userId}`).emit("order:status", event);
    io.to("admin").emit("order:status", event);
    return;
  }
  if (type === "order.payment") {
    const body = payload as StatusPayload & { paymentStatus: string };
    io.to("admin").emit("order:payment", {
      eventId: body.eventId,
      orderId: body.orderId,
      status: body.status,
      fulfillment: body.fulfillment,
      publicNumber: body.publicNumber,
      paymentStatus: body.paymentStatus,
    });
  }
}
