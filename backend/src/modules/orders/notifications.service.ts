import { prisma } from "../../database/prisma.js";

const notificationInclude = {
  order: { select: { id: true, publicNumber: true, status: true, fulfillment: true } },
} as const;

function presentNotification(item: {
  id: string;
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
  orderId: string | null;
  order: { id: string; publicNumber: number; status: string; fulfillment: string } | null;
}) {
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    readAt: item.readAt,
    createdAt: item.createdAt,
    orderId: item.orderId,
    order: item.order,
  };
}

export async function listCustomerNotifications(userId: string) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { audience: "CUSTOMER", userId },
      include: notificationInclude,
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({ where: { audience: "CUSTOMER", userId, readAt: null } }),
  ]);
  return { unreadCount, items: items.map(presentNotification) };
}

export async function markCustomerNotificationsRead(userId: string, ids?: string[]) {
  await prisma.notification.updateMany({
    where: {
      audience: "CUSTOMER",
      userId,
      readAt: null,
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
  return listCustomerNotifications(userId);
}

export async function listAdminNotifications() {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { audience: "ADMIN" },
      include: notificationInclude,
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({ where: { audience: "ADMIN", readAt: null } }),
  ]);
  return { unreadCount, items: items.map(presentNotification) };
}

export async function markAdminNotificationsRead(ids?: string[]) {
  await prisma.notification.updateMany({
    where: {
      audience: "ADMIN",
      readAt: null,
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
  return listAdminNotifications();
}
