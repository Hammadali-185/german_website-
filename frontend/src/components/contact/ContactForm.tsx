"use client";

import { api } from "@/lib/api";
import { FormEvent, useState } from "react";

export function ContactForm() {
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setStatus("");
    try {
      await api("/api/contact", {
        method: "POST",
        body: JSON.stringify({ name: data.get("name"), email: data.get("email"), message: data.get("message") }),
      });
      setStatus("Die Nachricht ist gespeichert. Sie wird nicht per E-Mail weitergeleitet, weil keine Restaurant-Adresse veröffentlicht ist.");
      event.currentTarget.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Senden fehlgeschlagen.");
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 bg-white p-5">
      <input name="name" required placeholder="Name" className="border border-ink/15 px-3 py-3" />
      <input name="email" type="email" required placeholder="E-Mail" className="border border-ink/15 px-3 py-3" />
      <textarea name="message" required minLength={5} placeholder="Nachricht" className="min-h-32 border border-ink/15 px-3 py-3" />
      <button className="bg-brand px-4 py-3 text-sm font-semibold text-white">Nachricht speichern</button>
      {status ? <p className="text-sm text-mute">{status}</p> : null}
    </form>
  );
}
