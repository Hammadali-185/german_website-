import "../config/load-env.js";
import { describe, expect, it } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requireAdmin, requireCsrf, requireUser } from "./auth.js";

function run(middleware: (req: Request, res: Response, next: NextFunction) => void, req: object) {
  return new Promise<unknown>((resolve) => {
    middleware(req as Request, {} as Response, (error) => resolve(error ?? null));
  });
}

describe("access control", () => {
  it("rejects anonymous and customer access to admin actions", async () => {
    const anonymous = await run(requireAdmin, {});
    expect(anonymous).toMatchObject({ status: 401, code: "AUTH" });
    const customer = await run(requireAdmin, { user: { role: "CUSTOMER" } as Request["user"] });
    expect(customer).toMatchObject({ status: 403, code: "FORBIDDEN" });
    const admin = await run(requireAdmin, { user: { role: "ADMIN" } as Request["user"] });
    expect(admin).toBeNull();
  });

  it("rejects a protected account route without a session", async () => {
    const error = await run(requireUser, {});
    expect(error).toMatchObject({ status: 401, code: "AUTH" });
  });

  it("rejects a mutation whose CSRF header does not match the cookie", async () => {
    const request = {
      method: "POST",
      cookies: { pb_csrf: "cookie-token" },
      get: (name: string) => (name === "x-csrf-token" ? "other-token" : undefined),
    };
    const error = await run(requireCsrf, request);
    expect(error).toMatchObject({ status: 403, code: "CSRF" });
    const ok = await run(requireCsrf, { ...request, get: () => "cookie-token" });
    expect(ok).toBeNull();
  });
});
