import type { NextFunction, Request, Response } from "express";
import { prisma } from "../database/prisma.js";
import { HttpError } from "../utils/http.js";
import { hashToken, newToken } from "../utils/password.js";
import { secureCookies } from "../config/env.js";

export const SESSION_COOKIE = "pb_session";
export const CSRF_COOKIE = "pb_csrf";

const cookieBase = {
  sameSite: "lax" as const,
  secure: secureCookies,
  path: "/",
};

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, { ...cookieBase, httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 14 });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { ...cookieBase, httpOnly: true });
}

export function issueCsrf(res: Response) {
  const token = newToken();
  res.cookie(CSRF_COOKIE, token, { ...cookieBase, httpOnly: false, maxAge: 1000 * 60 * 60 * 12 });
  return token;
}

export function ensureCsrf(req: Request, res: Response, next: NextFunction) {
  if (!req.cookies?.[CSRF_COOKIE]) issueCsrf(res);
  next();
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }
  const cookie = req.cookies?.[CSRF_COOKIE];
  const header = req.get("x-csrf-token");
  if (!cookie || !header || cookie !== header) {
    next(new HttpError(403, "CSRF-Prüfung fehlgeschlagen.", "CSRF"));
    return;
  }
  next();
}

export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) {
      next();
      return;
    }
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt.getTime() < Date.now()) {
      next();
      return;
    }
    req.user = session.user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(new HttpError(401, "Anmeldung erforderlich.", "AUTH"));
    return;
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(new HttpError(401, "Anmeldung erforderlich.", "AUTH"));
    return;
  }
  if (req.user.role !== "ADMIN") {
    next(new HttpError(403, "Keine Berechtigung.", "FORBIDDEN"));
    return;
  }
  next();
}
