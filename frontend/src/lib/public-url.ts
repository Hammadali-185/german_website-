const PLACEHOLDERS = new Set(["", "empty", "null", "undefined", "none", "-"]);

/** Treat blank and placeholder env values as unset so the Next rewrite can be used. */
export function publicApiBase(value = process.env.NEXT_PUBLIC_API_URL) {
  const cleaned = value?.trim() ?? "";
  if (!cleaned || PLACEHOLDERS.has(cleaned.toLowerCase())) return "";
  return cleaned.replace(/\/$/, "");
}

export function publicSocketUrl(value = process.env.NEXT_PUBLIC_SOCKET_URL) {
  const cleaned = value?.trim() ?? "";
  if (!cleaned || PLACEHOLDERS.has(cleaned.toLowerCase())) {
    if (typeof window !== "undefined" && window.location.hostname !== "localhost") return window.location.origin;
    return "http://localhost:4000";
  }
  return cleaned.replace(/\/$/, "");
}

export function backendOrigin(value = process.env.BACKEND_URL) {
  const cleaned = value?.trim() ?? "";
  if (!cleaned || PLACEHOLDERS.has(cleaned.toLowerCase())) return "http://localhost:4000";
  return cleaned.replace(/\/$/, "");
}
