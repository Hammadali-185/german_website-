import { Router } from "express";
import { asyncRoute } from "../../utils/http.js";
import { requireUser, SESSION_COOKIE, setSessionCookie, clearSessionCookie, issueCsrf } from "../../middleware/auth.js";
import { authLimiter } from "../../middleware/rateLimit.js";
import { addressSchema, loginSchema, profileSchema, publicUser, registerSchema } from "./auth.schema.js";
import { createAddress, deleteAddress, listAddresses, loginUser, logoutUser, registerUser, updateProfile } from "./auth.service.js";

export const authRouter = Router();

authRouter.get(
  "/auth/csrf",
  asyncRoute(async (_req, res) => {
    res.json({ csrfToken: issueCsrf(res) });
  }),
);

authRouter.post(
  "/auth/register",
  authLimiter,
  asyncRoute(async (req, res) => {
    const result = await registerUser(registerSchema.parse(req.body));
    setSessionCookie(res, result.token);
    res.status(201).json({ user: result.user });
  }),
);

authRouter.post(
  "/auth/login",
  authLimiter,
  asyncRoute(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const result = await loginUser(body.email, body.password);
    setSessionCookie(res, result.token);
    res.json({ user: result.user });
  }),
);

authRouter.post(
  "/auth/logout",
  asyncRoute(async (req, res) => {
    await logoutUser(req.cookies?.[SESSION_COOKIE]);
    clearSessionCookie(res);
    res.json({ ok: true });
  }),
);

authRouter.get(
  "/auth/me",
  asyncRoute(async (req, res) => {
    res.json({ user: req.user ? publicUser(req.user) : null });
  }),
);

authRouter.patch(
  "/auth/me",
  requireUser,
  asyncRoute(async (req, res) => {
    res.json(await updateProfile(req.user!.id, profileSchema.parse(req.body)));
  }),
);

authRouter.get(
  "/account/addresses",
  requireUser,
  asyncRoute(async (req, res) => {
    res.json(await listAddresses(req.user!.id));
  }),
);

authRouter.post(
  "/account/addresses",
  requireUser,
  asyncRoute(async (req, res) => {
    res.status(201).json(await createAddress(req.user!.id, addressSchema.parse(req.body)));
  }),
);

authRouter.delete(
  "/account/addresses/:id",
  requireUser,
  asyncRoute(async (req, res) => {
    await deleteAddress(req.user!.id, req.params.id);
    res.json({ ok: true });
  }),
);
