import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, "Mindestens 8 Zeichen."),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  phone: z.string().trim().default(""),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const profileSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  phone: z.string().trim().default(""),
});

export const addressSchema = z.object({
  label: z.string().trim().min(1).default("Zuhause"),
  street: z.string().trim().min(1),
  postalCode: z.string().trim().regex(/^\d{5}$/),
  city: z.string().trim().min(1),
  extra: z.string().trim().default(""),
});

export function publicUser(user: { id: string; email: string; firstName: string; lastName: string; phone: string; role: string }) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
  };
}
