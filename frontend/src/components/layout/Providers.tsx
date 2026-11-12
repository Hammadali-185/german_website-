"use client";

import { ensureCsrf } from "@/lib/api";
import { useEffect, useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    ensureCsrf().catch(() => undefined);
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setMessage(detail);
      window.setTimeout(() => setMessage(null), 2800);
    };
    window.addEventListener("pb-toast", onToast);
    return () => window.removeEventListener("pb-toast", onToast);
  }, []);

  return (
    <>
      {children}
      {message ? (
        <div role="status" className="fixed bottom-5 left-1/2 z-[70] max-w-sm -translate-x-1/2 bg-ink px-4 py-3 text-sm text-cream shadow-card">
          {message}
        </div>
      ) : null}
    </>
  );
}

export function toast(message: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("pb-toast", { detail: message }));
}
