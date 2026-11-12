"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";

export function HomeHero({ open }: { open: boolean }) {
  const reduce = useReducedMotion();
  const [play, setPlay] = useState(false);

  useLayoutEffect(() => {
    if (reduce === null) return;
    if (reduce || sessionStorage.getItem("pb-intro") === "1") {
      setPlay(true);
      return;
    }
    const start = () => setPlay(true);
    window.addEventListener("pb-intro-open", start);
    return () => window.removeEventListener("pb-intro-open", start);
  }, [reduce]);

  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 22 },
          animate: play ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 },
          transition: { delay, duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <section className="mx-auto grid max-w-7xl items-end gap-8 px-4 pb-8 pt-8 sm:px-6 lg:grid-cols-12 lg:pt-16">
      <div className="lg:col-span-6 lg:pb-8">
        <motion.p {...rise(0.05)} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs uppercase tracking-[0.14em] text-brand shadow-sm sm:tracking-[0.22em]">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          Good food. Great moments. Always fresh.
        </motion.p>
        <motion.h1 {...rise(0.16)} className="mt-5 font-display text-[clamp(2.8rem,12vw,6.4rem)] leading-[0.88]">
          Frisch aus
          <br />
          dem Ofen.
          <br />
          <span className="text-brand">Direkt zu dir.</span>
        </motion.h1>
        <motion.p {...rise(0.28)} className="mt-6 max-w-md text-lg leading-relaxed text-mute">
          Entdecke unsere Pizza, Burger und italienischen Spezialitäten. Frisch zubereitet und direkt zu dir nach Hause.
        </motion.p>
        <motion.div {...rise(0.4)} className="mt-8 flex flex-wrap gap-3">
          <Link href="/menu" className="inline-flex min-h-12 items-center rounded-full bg-brand px-6 text-sm font-semibold text-white shadow-card transition hover:bg-brand-deep">
            Jetzt bestellen
          </Link>
          <Link href="/menu" className="inline-flex min-h-12 items-center rounded-full border border-ink/10 bg-white px-6 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5">
            Speisekarte entdecken
          </Link>
        </motion.div>
      </div>
      <motion.div
        className="relative lg:col-span-6"
        initial={reduce ? false : { opacity: 0, scale: 1.05 }}
        animate={reduce || play ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute -left-3 top-8 hidden h-[78%] w-16 rounded-full bg-brand lg:block" />
        <img src="/images/original/pizzen.jpg" alt="Veröffentlichtes Kategoriebild der Pizzen von Pizza Blitz." className="aspect-[4/3] w-full rounded-3xl object-cover shadow-card" />
        <motion.div
          className="absolute bottom-3 left-3 rounded-2xl bg-forest px-4 py-3 text-cream shadow-card sm:bottom-5 sm:left-6 sm:px-5 sm:py-4"
          animate={reduce || !play ? undefined : { y: [0, -6, 0] }}
          transition={reduce ? undefined : { delay: 1.1, duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <p className="text-xs uppercase tracking-[0.18em] text-cream/60">{open ? "Geöffnet" : "Geschlossen"}</p>
          <p className="font-display text-2xl">Abholung & Lieferung</p>
        </motion.div>
      </motion.div>
    </section>
  );
}
