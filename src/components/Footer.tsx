import Link from "next/link";
import { addressLine, site } from "@/content/site";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`wrap ${styles.grid}`}>
        <div>
          <p className={styles.logo}>
            BISS<span>WERK</span>
          </p>
          <p className={styles.lead}>
            Fast Food zum Mitnehmen. Diese Website ist ein Gestaltungsentwurf.
            Angaben, Preise und Fotos sind Platzhalter.
          </p>
        </div>
        <div>
          <h2>Besuch</h2>
          <p>{addressLine()}</p>
          <p className={styles.note}>Demo-Adresse, kein echtes Lokal.</p>
          <ul className={styles.hours}>
            {site.hours.map((row) => (
              <li key={row.days}>
                <span>{row.days}</span>
                <span>{row.time}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.contact}>
          <h2>Kontakt</h2>
          <p>
            <a href={site.phoneHref}>{site.phoneDisplay}</a>
          </p>
          <p>
            <a href={site.emailHref}>{site.email}</a>
          </p>
          <ul className={styles.links}>
            <li>
              <Link href="/speisekarte">Speisekarte</Link>
            </li>
            <li>
              <Link href="/impressum">Impressum</Link>
            </li>
            <li>
              <Link href="/datenschutz">Datenschutz</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className={`wrap ${styles.bottom}`}>
        <p>© 2026 BISSWERK Demo</p>
        <p>Fotos sind vorläufige Platzhalter.</p>
      </div>
    </footer>
  );
}
