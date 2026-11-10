import Image from "next/image";
import { CategoryNav } from "@/components/CategoryNav";
import { ItemHit } from "@/components/ItemHit";
import { Price } from "@/components/Price";
import type { MenuCategory, MenuTag } from "@/content/menu";
import styles from "./MenuBoard.module.css";

type MenuBoardProps = {
  categories: MenuCategory[];
};

function toneClass(tag: MenuTag): string {
  if (tag === "Beliebt") return styles.tagAccent;
  if (tag === "Scharf") return styles.tagDark;
  return styles.tagPlain;
}

export function MenuBoard({ categories }: MenuBoardProps) {
  return (
    <div className={`wrap ${styles.page}`}>
      <header className={styles.intro}>
        <p className={styles.kicker}>Die Karte</p>
        <h1>Speisekarte</h1>
        <span className={styles.rule} aria-hidden="true" />
        <p>
          Wähl ein Gericht, pass es an und leg es in den Warenkorb. Alle Preise
          in Euro, inklusive Mehrwertsteuer.
        </p>
      </header>
      <CategoryNav categories={categories} sticky />
      {categories.map((category) => (
        <section key={category.id} id={category.id} className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{category.name}</h2>
            <p>{category.description}</p>
          </div>
          <div className={styles.list}>
            {category.items.map((item) => (
              <article key={item.id} id={item.id} className={styles.item}>
                <div className={styles.media}>
                  <Image
                    src={item.image}
                    alt={item.imageAlt}
                    fill
                    sizes="(max-width: 800px) 104px, 180px"
                    className={styles.photo}
                  />
                </div>
                <div className={styles.body}>
                  <div className={styles.head}>
                    <h3>{item.name}</h3>
                    <Price cents={item.priceCents} className={styles.price} />
                  </div>
                  <p className={styles.description}>{item.description}</p>
                  {item.tags && item.tags.length > 0 ? (
                    <ul className={styles.tags}>
                      {item.tags.map((tag) => (
                        <li key={tag} className={toneClass(tag)}>
                          {tag}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className={styles.allergens}>
                    <span className="srOnly">Allergene: </span>
                    {item.allergens.length > 0
                      ? item.allergens.join(" · ")
                      : "Ohne gekennzeichnete Allergene"}
                  </p>
                  <span className={styles.edit}>Anpassen</span>
                </div>
                <ItemHit
                  itemId={item.id}
                  name={item.name}
                  priceCents={item.priceCents}
                />
              </article>
            ))}
          </div>
        </section>
      ))}
      <p className={styles.note}>
        Allergene sind mit den üblichen Kurzbezeichnungen markiert. Die
        Fritteuse wird in dieser Demo als gemeinsam genutzt angenommen. Angaben
        und Fotos sind Platzhalter.
      </p>
    </div>
  );
}
