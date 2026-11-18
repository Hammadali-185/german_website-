import { z } from "zod";

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  quantity: z.number().int().positive().max(50),
  choiceOptionIds: z.array(z.string()).default([]),
  extraIds: z.array(z.string()).default([]),
});

export const quoteSchema = z.object({
  fulfillment: z.enum(["DELIVERY", "PICKUP"]),
  postalCode: z.string().trim().optional().default(""),
  deliveryAreaId: z.string().optional(),
  latitude: z.number().gte(-90).lte(90).optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
  items: z.array(cartItemSchema).min(1),
});

const phoneSchema = z
  .string()
  .trim()
  .min(6)
  .max(30)
  .refine((value) => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 6 && digits.length <= 15 && /^\+?[0-9][0-9\s()/-]*$/.test(value);
  }, "Telefonnummer ist ungültig.");

export const orderSchema = quoteSchema.extend({
  idempotencyKey: z.string().trim().min(8).max(80).optional(),
  customer: z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z
      .string()
      .trim()
      .refine((value) => value === "" || z.string().email().safeParse(value).success, "Ungültige E-Mail.")
      .default(""),
    phone: phoneSchema,
  }),
  address: z.object({
    street: z.string().trim().default(""),
    postalCode: z.string().trim().default(""),
    city: z.string().trim().default(""),
    latitude: z.number().gte(-90).lte(90).optional(),
    longitude: z.number().gte(-180).lte(180).optional(),
  }),
  notes: z.string().trim().max(500).default(""),
  paymentMethod: z.enum(["CASH", "PAYPAL", "CARD", "SOFORT"]),
});

export const contactSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  message: z.string().trim().min(5).max(2000),
});
