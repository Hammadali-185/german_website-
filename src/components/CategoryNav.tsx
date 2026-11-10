import Link from "next/link";
import styles from "./CategoryNav.module.css";

type CategoryNavProps = {
  categories: { id: string; name: string }[];
  hrefBase?: string;
  sticky?: boolean;
};

export function CategoryNav({
  categories,
  hrefBase = "",
  sticky = false,
}: CategoryNavProps) {
  return (
    <nav
      aria-label="Kategorien"
      className={`${styles.nav} ${sticky ? styles.sticky : ""}`}
    >
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`${hrefBase}#${category.id}`}
          className={styles.link}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}
