"use client";

import { motion } from "framer-motion";
import { useLayoutEffect, useState } from "react";

const STORAGE_KEY = "pb-intro";
const HOLD_MS = 500;
const OPEN_MS = 480;

function finishIntro() {
  sessionStorage.setItem(STORAGE_KEY, "1");
  window.dispatchEvent(new Event("pb-intro-open"));
}

function dismissBootCover() {
  document.getElementById("pb-boot")?.remove();
}

function releasePage() {
  dismissBootCover();
  document.documentElement.classList.remove("pb-intro");
  document.body.style.overflow = "";
}

export function OpeningSequence() {
  const [stage, setStage] = useState<"hold" | "open" | "gone">("hold");

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishIntro();
      releasePage();
      setStage("gone");
      return;
    }
    dismissBootCover();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const openAt = window.setTimeout(() => {
      finishIntro();
      document.documentElement.classList.remove("pb-intro");
      setStage("open");
    }, HOLD_MS);
    const goneAt = window.setTimeout(() => {
      document.body.style.overflow = previous;
      releasePage();
      setStage("gone");
    }, HOLD_MS + OPEN_MS + 40);
    return () => {
      window.clearTimeout(openAt);
      window.clearTimeout(goneAt);
    };
  }, []);

  if (stage === "gone") return null;

  function skip() {
    finishIntro();
    releasePage();
    setStage("gone");
  }

  return (
    <div data-intro className="fixed inset-0 z-[80]" role="dialog" aria-label="Pizza Blitz wird geöffnet">
      <motion.div
        className="absolute inset-x-0 top-0 h-1/2 bg-forest"
        initial={false}
        animate={stage === "open" ? { y: "-100%" } : { y: 0 }}
        transition={{ duration: OPEN_MS / 1000, ease: [0.76, 0, 0.24, 1], delay: 0 }}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 h-1/2 bg-forest"
        initial={false}
        animate={stage === "open" ? { y: "100%" } : { y: 0 }}
        transition={{ duration: OPEN_MS / 1000, ease: [0.76, 0, 0.24, 1], delay: 0 }}
      />
      <motion.div
        className="absolute left-0 right-0 top-1/2 h-px origin-center bg-gold"
        initial={{ scaleX: 0 }}
        animate={stage === "open" ? { scaleX: 1, opacity: 0 } : { scaleX: 1, opacity: 1 }}
        transition={{ duration: stage === "open" ? 0.15 : 0.35, delay: 0 }}
      />
      <motion.div
        className="absolute inset-0 grid place-items-center px-6 text-center"
        initial={false}
        animate={stage === "open" ? { opacity: 0, y: -8 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.16, delay: 0 }}
      >
        <div>
          <motion.img
            src="/images/original/logo.png"
            alt=""
            className="mx-auto h-24 w-24 sm:h-28 sm:w-28"
            initial={false}
            animate={{ scale: 1, opacity: 1 }}
          />
          <motion.p
            className="mt-5 font-display text-5xl leading-none text-white sm:text-6xl"
            initial={false}
            animate={{ opacity: 1, y: 0 }}
          >
            Pizza Blitz
          </motion.p>
          <motion.p
            className="mt-4 text-xs uppercase tracking-[0.28em] text-gold"
            initial={false}
            animate={{ opacity: 1 }}
          >
            Frisch aus dem Ofen
          </motion.p>
        </div>
      </motion.div>
      <button type="button" onClick={skip} className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 min-h-11 px-3 text-sm text-cream/80 underline">
        Überspringen
      </button>
    </div>
  );
}
