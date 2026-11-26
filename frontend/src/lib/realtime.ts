"use client";

import { io, type Socket } from "socket.io-client";
import { publicSocketUrl } from "./public-url";

export function socketUrl() {
  return publicSocketUrl();
}

export function openSocket(auth: { ticket?: string; trackingToken?: string }) {
  return io(socketUrl(), {
    auth,
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    transports: ["websocket", "polling"],
  });
}

export type LiveSocket = Socket;

export function rememberEvent(seen: Set<string>, eventId: string) {
  if (!eventId || seen.has(eventId)) return false;
  seen.add(eventId);
  if (seen.size > 200) {
    const first = seen.values().next().value;
    if (first) seen.delete(first);
  }
  return true;
}
