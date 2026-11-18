"use client";

import { io, type Socket } from "socket.io-client";

export function socketUrl() {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") return window.location.origin;
  return "http://localhost:4000";
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
