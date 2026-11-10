"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCart } from "@/components/cart-context";
import { site } from "@/content/site";
import styles from "./Header.module.css";

const links = [
  { href: "/", label: "Start" },
  { href: "/speisekarte", label: "Speisekarte" },
  { href: "/#standort", label: "Standort" },
] as const;

export function Header() {
  const pathname = usePathname();
  return <HeaderBar key={pathname} pathname={pathname} />;
}

function HeaderBar({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const { itemCount, openCart } = useCart();
  const cartLabel =
    itemCount === 0 ? "Warenkorb, leer" : `Warenkorb, ${itemCount} Artikel`;

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) return;

    const mobile = window.matchMedia("(max-width: 767px)");
    const previousOverflow = document.body.style.overflow;
    if (mobile.matches) document.body.style.overflow = "hidden";
    navRef.current?.querySelector<HTMLElement>("a")?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    const burger = burgerRef.current;
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      burger?.focus();
    };
  }, [open]);

  return (
    <header className={styles.header}>
      {open
        ? createPortal(
            <button
              type="button"
              className={styles.backdrop}
              aria-label="Menü schließen"
              onClick={() => setOpen(false)}
            />,
            document.body,
          )
        : null}
      <div className={`wrap ${styles.bar}`}>
        <Link href="/" className={styles.logo} aria-label="BISSWERK, zur Startseite">
          BISS<span>WERK</span>
        </Link>
        <span className={styles.demo}>Demo</span>
        <nav
          ref={navRef}
          id="site-menu"
          aria-label="Hauptnavigation"
          className={`${styles.nav} ${open ? styles.navOpen : ""}`}
        >
          {links.map((link) => {
            const current =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          className={styles.cart}
          aria-label={cartLabel}
          onClick={() => {
            setOpen(false);
            openCart();
          }}
        >
          <CartIcon />
          {itemCount > 0 ? (
            <span className={styles.badge} aria-hidden="true">
              {itemCount > 99 ? "99+" : itemCount}
            </span>
          ) : null}
        </button>
        <a className={styles.call} href={site.phoneHref}>
          <span className={styles.short}>Anruf</span>
          <span className={styles.long}>{site.phoneDisplay}</span>
        </a>
        <button
          ref={burgerRef}
          type="button"
          className={`${styles.burger} ${open ? styles.burgerOpen : ""}`}
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen((value) => !value)}
        >
          Menü
        </button>
      </div>
    </header>
  );
}

function CartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 7h15l-1.5 9h-12L5 4H2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="20" r="1.4" fill="currentColor" />
      <circle cx="17" cy="20" r="1.4" fill="currentColor" />
    </svg>
  );
}
