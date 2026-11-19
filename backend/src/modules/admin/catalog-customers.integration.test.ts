import "../../config/load-env.js";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../utils/http.js";
import { cleanImageUrl, deleteCategory, listExtras, listProducts } from "./catalog.service.js";
import { customerOrders, listCustomers } from "./customers.service.js";

describe("catalog and customers", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects unsafe image addresses", () => {
    expect(cleanImageUrl("  ")).toBeNull();
    expect(cleanImageUrl("https://example.com/pizza.png")).toBe("https://example.com/pizza.png");
    expect(() => cleanImageUrl("javascript:alert(1)")).toThrow(HttpError);
  });

  it("keeps product identity, blocks a used category, and pages extras in the database", async () => {
    const stamp = Date.now().toString();
    const category = await prisma.category.findFirst({ orderBy: { sortOrder: "asc" } });
    expect(category).toBeTruthy();
    const empty = await prisma.category.create({ data: { name: `Leer ${stamp}`, slug: `leer-${stamp}`, sortOrder: 9000 } });
    const used = await prisma.category.create({ data: { name: `Belegt ${stamp}`, slug: `belegt-${stamp}`, sortOrder: 9001 } });
    const product = await prisma.product.create({
      data: {
        categoryId: category!.id,
        sku: `T${stamp}`,
        name: `Testprodukt ${stamp}`,
        description: "Vorher",
        image: cleanImageUrl("https://example.com/pizza.png"),
        variants: { create: { sourcePriceId: `manual-${stamp}`, label: "Normal", priceCents: 1250, sortOrder: 0 } },
      },
      include: { variants: true },
    });
    const blocked = await prisma.product.create({
      data: {
        categoryId: used.id,
        sku: `B${stamp}`,
        name: `Block ${stamp}`,
        description: "",
        variants: { create: { sourcePriceId: `block-${stamp}`, label: "Normal", priceCents: 100, sortOrder: 0 } },
      },
    });
    const order = await prisma.order.create({
      data: {
        fulfillment: "PICKUP",
        status: "COMPLETED",
        customerFirstName: "Snapshot",
        customerLastName: stamp,
        customerPhone: "000",
        subtotalCents: 1250,
        deliveryFeeCents: 0,
        totalCents: 1250,
        minimumOrderCents: 0,
        idempotencyKey: `catalog-${stamp}`,
        items: { create: { sku: product.sku, productName: product.name, variantLabel: "Normal", unitPriceCents: 1250, quantity: 1, lineTotalCents: 1250, customizationJson: {} } },
      },
      include: { items: true },
    });
    try {
      const updated = await prisma.product.update({
        where: { id: product.id },
        data: { name: `Geändert ${stamp}`, description: "Nachher", available: false, image: cleanImageUrl("https://example.com/pizza-2.png") },
      });
      expect(updated.id).toBe(product.id);
      expect(updated.available).toBe(false);
      expect(updated.image).toBe("https://example.com/pizza-2.png");
      expect(await prisma.productVariant.count({ where: { id: product.variants[0]!.id } })).toBe(1);
      await expect(deleteCategory(used.id)).rejects.toMatchObject({ status: 409, code: "CATEGORY_IN_USE" });
      expect(await prisma.category.findUnique({ where: { id: used.id } })).toBeTruthy();
      await prisma.product.delete({ where: { id: blocked.id } });
      await deleteCategory(used.id);
      expect(await prisma.category.findUnique({ where: { id: used.id } })).toBeNull();
      await deleteCategory(empty.id);
      const page = await listProducts({ q: stamp, page: 1, pageSize: 1 });
      expect(page.total).toBe(1);
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.variants[0]?.id).toBe(product.variants[0]?.id);
      const extras = await listExtras({ page: 1, pageSize: 1 });
      expect(extras.items).toHaveLength(1);
      expect(extras.total).toBeGreaterThan(1);
      await prisma.product.delete({ where: { id: product.id } });
      const snapshot = await prisma.orderItem.findUnique({ where: { id: order.items[0]!.id } });
      expect(snapshot?.productName).toBe(product.name);
      expect(snapshot?.sku).toBe(product.sku);
    } finally {
      await prisma.order.deleteMany({ where: { idempotencyKey: `catalog-${stamp}` } });
      await prisma.product.deleteMany({ where: { sku: { in: [`T${stamp}`, `B${stamp}`] } } });
      await prisma.category.deleteMany({ where: { slug: { in: [`leer-${stamp}`, `belegt-${stamp}`] } } });
    }
  });

  it("groups customers by phone, keeps guests apart, and omits credentials", async () => {
    const stamp = Date.now().toString();
    const digits = `0176${stamp.slice(-8)}`;
    const spaced = `${digits.slice(0, 4)} ${digits.slice(4)}`;
    const email = `phase4-${stamp}@example.test`;
    const user = await prisma.user.create({
      data: { email, passwordHash: "test-hash-not-a-secret", firstName: "Konto", lastName: "Kunde", phone: digits, role: "CUSTOMER" },
    });
    const keys = [`cust-a-${stamp}`, `cust-b-${stamp}`, `guest-a-${stamp}`, `guest-b-${stamp}`, `other-${stamp}`];
    try {
      await prisma.order.create({
        data: {
          fulfillment: "PICKUP", status: "COMPLETED", userId: user.id, customerFirstName: "Alt", customerLastName: `Name${stamp}`,
          customerEmail: email, customerPhone: spaced, subtotalCents: 1000, deliveryFeeCents: 0, totalCents: 1000, minimumOrderCents: 0,
          idempotencyKey: keys[0], createdAt: new Date(Date.now() - 60_000),
        },
      });
      await prisma.order.create({
        data: {
          fulfillment: "PICKUP", status: "REJECTED", userId: user.id, customerFirstName: "Neu", customerLastName: `Name${stamp}`,
          customerEmail: email, customerPhone: digits, subtotalCents: 9000, deliveryFeeCents: 0, totalCents: 9000, minimumOrderCents: 0,
          idempotencyKey: keys[1],
        },
      });
      await prisma.order.create({
        data: {
          fulfillment: "PICKUP", status: "COMPLETED", customerFirstName: "Gast", customerLastName: `Eins${stamp}`,
          customerPhone: "", subtotalCents: 300, deliveryFeeCents: 0, totalCents: 300, minimumOrderCents: 0, idempotencyKey: keys[2],
        },
      });
      await prisma.order.create({
        data: {
          fulfillment: "PICKUP", status: "COMPLETED", customerFirstName: "Gast", customerLastName: `Zwei${stamp}`,
          customerPhone: "--", subtotalCents: 400, deliveryFeeCents: 0, totalCents: 400, minimumOrderCents: 0, idempotencyKey: keys[3],
        },
      });
      await prisma.order.create({
        data: {
          fulfillment: "PICKUP", status: "COMPLETED", customerFirstName: "Anders", customerLastName: `Name${stamp}`,
          customerPhone: `0188${stamp.slice(-8)}`, customerEmail: `other-${stamp}@example.test`, subtotalCents: 200, deliveryFeeCents: 0, totalCents: 200, minimumOrderCents: 0,
          idempotencyKey: keys[4],
        },
      });
      const found = await listCustomers({ q: email, sort: "latest", page: 1, pageSize: 20 });
      expect(found.total).toBe(1);
      expect(found.items[0]).toMatchObject({ key: digits, firstName: "Neu", orderCount: 2, spendingCents: 1000 });
      expect(found.items[0]?.account).toEqual({ id: user.id, email, firstName: "Konto", lastName: "Kunde" });
      expect(JSON.stringify(found)).not.toContain("passwordHash");
      expect(JSON.stringify(found)).not.toContain("test-hash");
      const guests = await listCustomers({ q: `Eins${stamp}`, sort: "name", page: 1, pageSize: 1 });
      const secondGuest = await listCustomers({ q: `Zwei${stamp}`, sort: "name", page: 1, pageSize: 1 });
      expect(guests.items[0]?.key.startsWith("guest:")).toBe(true);
      expect(secondGuest.items[0]?.key.startsWith("guest:")).toBe(true);
      expect(guests.items[0]?.key).not.toBe(secondGuest.items[0]?.key);
      const history = await customerOrders(digits, 1, 1);
      expect(history.total).toBe(2);
      expect(history.items).toHaveLength(1);
      const names = await listCustomers({ q: `Name${stamp}`, sort: "orders", page: 1, pageSize: 1 });
      expect(names.total).toBe(2);
      expect(names.items).toHaveLength(1);
    } finally {
      await prisma.order.deleteMany({ where: { idempotencyKey: { in: keys } } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
