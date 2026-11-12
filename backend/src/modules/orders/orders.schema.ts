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
  items: z.array(cartItemSchema).min(1),
});

export const orderSchema = quoteSchema.extend({
  customer: z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z.string().trim().email(),
    phone: z.string().trim().min(6),
  }),
  address: z.object({
    street: z.string().trim().default(""),
    postalCode: z.string().trim().default(""),
    city: z.string().trim().default(""),
  }),
  notes: z.string().trim().max(500).default(""),
  paymentMethod: z.enum(["CASH", "PAYPAL", "CARD", "SOFORT"]),
});

export const contactSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  message: z.string().trim().min(5).max(2000),
});
