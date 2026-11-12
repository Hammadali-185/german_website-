import { randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { secureCookies } from "../config/env.js";
import { HttpError } from "../utils/http.js";

const COOKIE = "pb_csrf";

export function ensureCsrf(req: Request, res: Response, next: NextFunction) {
  if (!req.cookies?.[COOKIE]) {
    const token = randomBytes(32).toString("hex");
    res.cookie(COOKIE, token, {
      sameSite: "lax",
      httpOnly: false,
      secure: secureCookies,
      path: "/",
    });
  }
  next();
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }
  const cookie = req.cookies?.[COOKIE];
  const header = req.get("x-csrf-token");
  if (!cookie || !header || cookie !== header) {
    next(new HttpError(403, "CSRF-Prüfung fehlgeschlagen.", "CSRF"));
    return;
  }
  next();
}
