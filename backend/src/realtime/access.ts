import { prisma } from "../database/prisma.js";
import { hashToken, newToken } from "../utils/password.js";

export async function issueTicket(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.realtimeTicket.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });
  return { token, expiresAt };
}

export async function userFromTicket(token: string) {
  if (!token) return null;
  const ticket = await prisma.realtimeTicket.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!ticket || ticket.expiresAt.getTime() < Date.now()) return null;
  return ticket.user;
}

export async function orderIdFromTrackingToken(token: string) {
  if (!token) return null;
  const order = await prisma.order.findUnique({
    where: { trackingTokenHash: hashToken(token) },
    select: { id: true },
  });
  return order?.id ?? null;
}

export async function canWatchOrder(input: { userId?: string; orderId: string; trackingToken?: string; boundOrderId?: string }) {
  if (!input.orderId) return false;
  if (input.boundOrderId && input.boundOrderId === input.orderId) return true;
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { userId: true, trackingTokenHash: true },
  });
  if (!order) return false;
  if (input.userId && order.userId === input.userId) return true;
  if (input.trackingToken && order.trackingTokenHash === hashToken(input.trackingToken)) return true;
  return false;
}
