import Image from "next/image";
import { Button } from "@/components/Button";
import { CategoryNav } from "@/components/CategoryNav";
import { Orderable } from "@/components/Orderable";
import { Price } from "@/components/Price";
import { getCategories, getFeaturedItems, getItemById } from "@/content/menu";
import { addressLine, site } from "@/content/site";
import styles from "./page.module.css";

export default function HomePage() {
  const hero = getItemById("werkburger");
  const kitchen = getItemById("crispy-filet");
  const featured = getFeaturedItems();
  const categories = getCategories();

  return (
    <>
      <section className={`wrap ${styles.hero}`}>
        <div className={styles.copy}>
          <p className={styles.kicker}>Fast Food · Berlin</p>
          <h1>{site.tagline}</h1>
          <p className={styles.lead}>
            Saftige Burger, knuspriges Chicken und heiße Beilagen. Ausgesucht,
            ausgebraten, mitgenommen.
          </p>
          <div className={styles.actions}>
            <Button href="/speisekarte">Speisekarte</Button>
            <Button href={site.phoneHref} variant="ghost">
              {site.phoneDisplay}
            </Button>
          </div>
        </div>
        <Orderable itemId={hero.id} className={styles.heroMedia}>
          <Image
            src={hero.image}
            alt={hero.imageAlt}
            fill
            priority
            sizes="(max-width: 767px) 100vw, 560px"
            className={styles.photo}
          />
          <span className={styles.ticket}>
            <span className={styles.ticketLabel}>Heute auf der Karte</span>
            <span className={styles.ticketName}>{hero.name}</span>
            <Price cents={hero.priceCents} className={styles.ticketPrice} />
          </span>
        </Orderable>
      </section>

      <div className={`wrap ${styles.categories}`}>
        <CategoryNav categories={categories} hrefBase="/speisekarte" />
      </div>

      <section className={`wrap ${styles.section}`} aria-labelledby="gefragt">
        <div className={styles.sectionHead}>
          <h2 id="gefragt">Gerade gefragt</h2>
          <Button href="/speisekarte" variant="ghost">
            Ganze Karte
          </Button>
        </div>
        <div className={styles.grid}>
          {featured.map((item) => (
            <Orderable key={item.id} itemId={item.id} className={styles.card}>
              <span className={styles.cardMedia}>
                <Image
                  src={item.image}
                  alt={item.imageAlt}
                  fill
                  sizes="(max-width: 900px) 100vw, 340px"
                  className={styles.photo}
                />
              </span>
              <span className={styles.cardBody}>
                <span className={styles.cardTop}>
                  <span className={styles.cardName}>{item.name}</span>
                  <Price cents={item.priceCents} className={styles.cardPrice} />
                </span>
                <span className={styles.cardText}>{item.description}</span>
              </span>
            </Orderable>
          ))}
        </div>
      </section>

      <section className={`wrap ${styles.section}`} aria-labelledby="ablauf">
        <div className={styles.flow}>
          <div>
            <p className={styles.kickerLight}>Bestellen</p>
            <h2 id="ablauf">In drei Schritten bestellt.</h2>
            <ol className={styles.steps}>
              {site.orderSteps.map((step) => (
                <li key={step.number}>
                  <span className={styles.stepNo}>{step.number}</span>
                  <span>
                    <span className={styles.stepTitle}>{step.title}</span>
                    <span className={styles.stepText}>{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className={styles.flowMedia}>
            <Image
              src={kitchen.image}
              alt={kitchen.imageAlt}
              fill
              sizes="(max-width: 900px) 100vw, 480px"
              className={styles.photo}
            />
          </div>
        </div>
      </section>

      <section
        id="standort"
        className={`wrap ${styles.section}`}
        aria-labelledby="standort-title"
      >
        <div className={styles.location}>
          <div className={styles.panel}>
            <p className={styles.kicker}>Abholung</p>
            <h2 id="standort-title" className={styles.address}>
              {site.address.street}
            </h2>
            <p className={styles.city}>
              {site.address.postalCode} {site.address.city}
            </p>
            <p className={styles.demoNote}>Demo-Adresse, kein echtes Lokal.</p>
            <div className={styles.locationActions}>
              <Button href={site.phoneHref}>Anrufen</Button>
              <Button href="/speisekarte" variant="ghost">
                Speisekarte
              </Button>
            </div>
          </div>
          <div className={styles.panel}>
            <h3 className={styles.hoursTitle}>Öffnungszeiten</h3>
            <dl className={styles.hours}>
              {site.hours.map((row) => (
                <div key={row.days}>
                  <dt>{row.days}</dt>
                  <dd>{row.time}</dd>
                </div>
              ))}
            </dl>
            <p className={styles.cityLine}>{addressLine()}</p>
          </div>
        </div>
      </section>
    </>
  );
}
