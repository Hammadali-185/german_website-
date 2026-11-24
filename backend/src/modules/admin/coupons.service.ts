import { Prisma, type Coupon } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../utils/http.js";

const activeOrder = { status: { notIn: ["REJECTED", "CANCELLED"] as ("REJECTED" | "CANCELLED")[] } };

export function rethrowCouponWrite(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new HttpError(409, "Dieser Gutscheincode ist bereits vorhanden.", "COUPON_CODE");
  }
  throw error;
}

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function couponCustomerKey(input: { userId?: string | null; phone: string; email?: string | null }) {
  if (input.userId) return `user:${input.userId}`;
  const digits = input.phone.replace(/\D/g, "");
  if (digits.length >= 6) return `phone:${digits}`;
  const email = input.email?.trim().toLowerCase();
  if (email) return `email:${email}`;
  return null;
}

export function couponDiscount(coupon: Pick<Coupon, "type" | "percentOff" | "amountOffCents" | "minimumSubtotalCents">, subtotalCents: number) {
  if (subtotalCents < coupon.minimumSubtotalCents) {
    throw new HttpError(400, "Der Mindestbestellwert für diesen Gutschein ist nicht erreicht.", "COUPON_MINIMUM");
  }
  const raw = coupon.type === "PERCENT" ? Math.floor((subtotalCents * (coupon.percentOff ?? 0)) / 100) : (coupon.amountOffCents ?? 0);
  return Math.max(0, Math.min(raw, subtotalCents));
}

export function couponSummary(coupon: Pick<Coupon, "type" | "percentOff" | "amountOffCents">) {
  return coupon.type === "PERCENT" ? `${coupon.percentOff ?? 0} %` : `${((coupon.amountOffCents ?? 0) / 100).toFixed(2)} EUR`;
}

async function usableCoupon(code: string, now = new Date()) {
  const coupon = await prisma.coupon.findUnique({ where: { code: normalizeCouponCode(code) } });
  if (!coupon || !coupon.active) throw new HttpError(400, "Der Gutschein ist nicht gültig.", "COUPON");
  if (coupon.startsAt && coupon.startsAt > now) throw new HttpError(400, "Der Gutschein ist noch nicht gültig.", "COUPON");
  if (coupon.endsAt && coupon.endsAt <= now) throw new HttpError(400, "Der Gutschein ist abgelaufen.", "COUPON_EXPIRED");
  return coupon;
}

export async function quoteCoupon(code: string | undefined, subtotalCents: number) {
  if (!code?.trim()) return { discountCents: 0, couponCode: null as string | null, couponSummary: null as string | null };
  const coupon = await usableCoupon(code);
  const discountCents = couponDiscount(coupon, subtotalCents);
  return { discountCents, couponCode: coupon.code, couponSummary: couponSummary(coupon) };
}

export async function reserveCoupon(
  tx: Prisma.TransactionClient,
  input: { code: string; subtotalCents: number; userId?: string | null; phone: string; email?: string | null },
) {
  const coupon = await usableCoupon(input.code);
  await tx.$queryRaw`SELECT id FROM "Coupon" WHERE id = ${coupon.id} FOR UPDATE`;
  const locked = await tx.coupon.findUnique({ where: { id: coupon.id } });
  if (!locked || !locked.active) throw new HttpError(400, "Der Gutschein ist nicht gültig.", "COUPON");
  if (locked.endsAt && locked.endsAt <= new Date()) throw new HttpError(400, "Der Gutschein ist abgelaufen.", "COUPON_EXPIRED");
  const discountCents = couponDiscount(locked, input.subtotalCents);
  const used = await tx.couponRedemption.count({ where: { couponId: locked.id, order: activeOrder } });
  if (locked.maxRedemptions != null && used >= locked.maxRedemptions) {
    throw new HttpError(400, "Der Gutschein ist aufgebraucht.", "COUPON_EXHAUSTED");
  }
  const customerKey = couponCustomerKey(input);
  if (locked.perCustomerLimit != null) {
    if (!customerKey) throw new HttpError(400, "Für dieses Kundenlimit werden Telefonnummer oder Konto benötigt.", "COUPON");
    const own = await tx.couponRedemption.count({ where: { couponId: locked.id, customerKey, order: activeOrder } });
    if (own >= locked.perCustomerLimit) throw new HttpError(400, "Dieser Gutschein wurde bereits eingelöst.", "COUPON_LIMIT");
  }
  return {
    couponId: locked.id,
    discountCents,
    couponCode: locked.code,
    couponSummary: couponSummary(locked),
    customerKey: customerKey ?? "anonymous",
  };
}

export async function listCoupons(query: { q?: string; page: number; pageSize: number }) {
  const q = query.q?.trim();
  const where = q ? { code: { contains: normalizeCouponCode(q), mode: "insensitive" as const } } : {};
  const [total, items] = await Promise.all([
    prisma.coupon.count({ where }),
    prisma.coupon.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { redemptions: true } } },
    }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function couponRedemptions(id: string, page: number, pageSize: number) {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new HttpError(404, "Gutschein nicht gefunden.", "NOT_FOUND");
  const where = { couponId: id };
  const [total, items] = await Promise.all([
    prisma.couponRedemption.count({ where }),
    prisma.couponRedemption.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        codeSnapshot: true,
        summary: true,
        discountCents: true,
        createdAt: true,
        order: { select: { id: true, publicNumber: true, status: true, totalCents: true, customerPhone: true } },
      },
    }),
  ]);
  return { items, total, page, pageSize };
}

export async function deleteUnusedCoupon(id: string) {
  const coupon = await prisma.coupon.findUnique({ where: { id }, include: { _count: { select: { redemptions: true } } } });
  if (!coupon) throw new HttpError(404, "Gutschein nicht gefunden.", "NOT_FOUND");
  if (coupon._count.redemptions > 0) throw new HttpError(409, "Eingelöste Gutscheine bleiben wegen der Bestellhistorie erhalten.", "COUPON_USED");
  await prisma.coupon.delete({ where: { id } });
  return { ok: true };
}
