import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={`wrap ${styles.page}`}>
      <p className={styles.kicker}>404</p>
      <h1>Diese Seite gibt es nicht.</h1>
      <p>Die Adresse stimmt nicht, oder die Seite wurde noch nicht angelegt.</p>
      <Link href="/" className={styles.link}>
        Zur Startseite
      </Link>
    </div>
  );
}
