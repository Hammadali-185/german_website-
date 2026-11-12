let csrfToken = "";

export async function ensureCsrf() {
  if (csrfToken) return csrfToken;
  const response = await fetch("/api/auth/csrf", { credentials: "include" });
  const data = (await response.json()) as { csrfToken?: string };
  csrfToken = data.csrfToken ?? "";
  return csrfToken;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    headers.set("content-type", "application/json");
    headers.set("x-csrf-token", await ensureCsrf());
  }
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Die Anfrage ist fehlgeschlagen.");
  }
  return data as T;
}
