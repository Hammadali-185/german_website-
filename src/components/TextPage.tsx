import styles from "./TextPage.module.css";

type TextPageProps = {
  kicker?: string;
  title: string;
  children: React.ReactNode;
};

export function TextPage({ kicker = "Demo", title, children }: TextPageProps) {
  return (
    <article className={`wrap ${styles.page}`}>
      <p className={styles.kicker}>{kicker}</p>
      <h1>{title}</h1>
      <div className={styles.body}>{children}</div>
    </article>
  );
}
