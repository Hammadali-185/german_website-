import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { z } from "zod";
import { clientOrigins } from "../config/env.js";
import { canWatchOrder, orderIdFromTrackingToken, userFromTicket } from "./access.js";
import { bindRealtimeServer, publishPending } from "./publish.js";

const watchSchema = z.object({
  orderId: z.string().min(1).max(80),
  trackingToken: z.string().min(10).max(200).optional(),
});

type SocketData = {
  userId?: string;
  role?: string;
  trackingOrderId?: string;
};

export function attachRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: clientOrigins, credentials: true },
    maxHttpBufferSize: 100_000,
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  });
  bindRealtimeServer(io);

  io.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth ?? {};
      const ticket = typeof auth.ticket === "string" ? auth.ticket : "";
      const trackingToken = typeof auth.trackingToken === "string" ? auth.trackingToken : "";
      const data = socket.data as SocketData;
      if (ticket) {
        const user = await userFromTicket(ticket);
        if (!user) {
          next(new Error("unauthorized"));
          return;
        }
        data.userId = user.id;
        data.role = user.role;
      }
      if (trackingToken) {
        const orderId = await orderIdFromTrackingToken(trackingToken);
        if (!orderId) {
          next(new Error("unauthorized"));
          return;
        }
        data.trackingOrderId = orderId;
      }
      if (!data.userId && !data.trackingOrderId) {
        next(new Error("unauthorized"));
        return;
      }
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const data = socket.data as SocketData;
    if (data.role === "ADMIN") socket.join("admin");
    if (data.userId) socket.join(`user:${data.userId}`);
    if (data.trackingOrderId) socket.join(`order:${data.trackingOrderId}`);

    socket.on("admin:join", (ack?: (result: { ok: boolean }) => void) => {
      if (data.role !== "ADMIN") {
        ack?.({ ok: false });
        return;
      }
      socket.join("admin");
      ack?.({ ok: true });
    });

    socket.on("order:watch", async (body: unknown, ack?: (result: { ok: boolean }) => void) => {
      const parsed = watchSchema.safeParse(body);
      if (!parsed.success) {
        ack?.({ ok: false });
        return;
      }
      const allowed = await canWatchOrder({
        userId: data.userId,
        orderId: parsed.data.orderId,
        trackingToken: parsed.data.trackingToken,
        boundOrderId: data.trackingOrderId,
      });
      if (!allowed) {
        ack?.({ ok: false });
        return;
      }
      socket.join(`order:${parsed.data.orderId}`);
      ack?.({ ok: true });
    });
  });

  void publishPending();
  return io;
}
