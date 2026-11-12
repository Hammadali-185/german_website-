"use client";

import { api } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      await api(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
          firstName: data.get("firstName"),
          lastName: data.get("lastName"),
          phone: data.get("phone") ?? "",
        }),
      });
      router.push("/account");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Anmeldung fehlgeschlagen.");
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-md gap-3 px-4 py-16">
      <h1 className="font-display text-5xl">{mode === "login" ? "Anmelden" : "Konto erstellen"}</h1>
      {mode === "register" ? (
        <>
          <input name="firstName" required placeholder="Vorname" className="border border-ink/15 px-3 py-3" />
          <input name="lastName" required placeholder="Nachname" className="border border-ink/15 px-3 py-3" />
          <input name="phone" placeholder="Telefon" className="border border-ink/15 px-3 py-3" />
        </>
      ) : null}
      <input name="email" type="email" required placeholder="E-Mail" className="border border-ink/15 px-3 py-3" />
      <input name="password" type="password" required minLength={8} placeholder="Passwort" className="border border-ink/15 px-3 py-3" />
      {error ? <p className="text-sm text-brand">{error}</p> : null}
      <button className="bg-brand px-4 py-3 text-sm font-semibold text-white">{mode === "login" ? "Anmelden" : "Registrieren"}</button>
      <Link href={mode === "login" ? "/register" : "/login"} className="text-sm text-mute">
        {mode === "login" ? "Noch kein Konto" : "Ich habe ein Konto"}
      </Link>
    </form>
  );
}
