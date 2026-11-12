import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../utils/http.js";
import { hashPassword, hashToken, newToken, verifyPassword } from "../../utils/password.js";
import { publicUser } from "./auth.schema.js";

const SESSION_MS = 1000 * 60 * 60 * 24 * 14;

export async function registerUser(input: { email: string; password: string; firstName: string; lastName: string; phone: string }) {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, "Für diese E-Mail gibt es bereits ein Konto.", "EXISTS");
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
    },
  });
  const token = await createSession(user.id);
  return { user: publicUser(user), token };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    throw new HttpError(401, "E-Mail oder Passwort ist falsch.", "AUTH");
  }
  const token = await createSession(user.id);
  return { user: publicUser(user), token };
}

export async function logoutUser(token: string | undefined) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

async function createSession(userId: string) {
  const token = newToken();
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + SESSION_MS) },
  });
  return token;
}

export async function updateProfile(userId: string, input: { firstName: string; lastName: string; phone: string }) {
  const user = await prisma.user.update({ where: { id: userId }, data: input });
  return publicUser(user);
}

export async function listAddresses(userId: string) {
  return prisma.address.findMany({ where: { userId }, orderBy: { label: "asc" } });
}

export async function createAddress(userId: string, input: { label: string; street: string; postalCode: string; city: string; extra: string }) {
  return prisma.address.create({ data: { ...input, userId } });
}

export async function deleteAddress(userId: string, addressId: string) {
  const address = await prisma.address.findFirst({ where: { id: addressId, userId } });
  if (!address) throw new HttpError(404, "Adresse nicht gefunden.", "NOT_FOUND");
  await prisma.address.delete({ where: { id: address.id } });
}
