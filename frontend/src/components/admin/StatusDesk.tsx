"use client";

import { api } from "@/lib/api";
import { useEffect, useState } from "react";

type Entry = { id: string; name: string; state: "installed" | "active" | "unavailable"; description: string };

const labels = { installed: "Installiert", active: "Aktiv", unavailable: "Nicht verfügbar" };

export function StatusDesk({ mode }: { mode: "extensions" | "connections" }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    api<{ extensions: Entry[]; connections: Entry[] }>("/api/admin/system")
      .then((status) => { if (!cancelled) setEntries(mode === "extensions" ? status.extensions : status.connections); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Der Status konnte nicht geladen werden."); });
    return () => { cancelled = true; };
  }, [mode]);
  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-[#C8102E]">{error}</p> : null}
      {entries.map((entry) => (
        <article key={entry.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl">{entry.name}</h2>
            <span className={`rounded-full px-2 py-1 text-xs ${entry.state === "unavailable" ? "bg-neutral-100 text-neutral-600" : "bg-[#1C1F22] text-white"}`}>{labels[entry.state]}</span>
          </div>
          <p className="mt-2 text-sm text-neutral-600">{entry.description}</p>
        </article>
      ))}
    </div>
  );
}
