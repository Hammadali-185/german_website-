import { Router } from "express";
import { requireUser } from "../middleware/auth.js";
import { asyncRoute } from "../utils/http.js";
import { issueTicket } from "./access.js";

export const realtimeRouter = Router();

realtimeRouter.post(
  "/realtime/ticket",
  requireUser,
  asyncRoute(async (req, res) => {
    res.json(await issueTicket(req.user!.id));
  }),
);
