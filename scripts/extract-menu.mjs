import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const CACHE_DIR = path.join(DATA_DIR, "cache");
const IMAGE_DIR = path.join(ROOT, "frontend", "public", "images", "original");
const BASE = "https://www.pizzablitz.online";

const CATEGORIES = [
  { slug: "angebot", name: "Angebot", expected: 9 },
  { slug: "burger-und-fast-food", name: "Burger und Fast food", expected: 19 },
  { slug: "pizzen", name: "Pizzen", expected: 47 },
  { slug: "american-pizza", name: "American Pizza", expected: 6 },
  { slug: "flammkuchen", name: "Flammkuchen", expected: 5 },
  { slug: "calzone", name: "Calzone", expected: 6 },
  { slug: "pizzabroetchen", name: "Pizzabrötchen", expected: 8 },
  { slug: "Salate", name: "Salate", expected: 17 },
  { slug: "putenschnitzel", name: "Putenschnitzel", expected: 10 },
  { slug: "vorspeisen", name: "Vorspeisen", expected: 8 },
  { slug: "pasta", name: "Pasta", expected: 11 },
  { slug: "al-forno", name: "Al Forno", expected: 11 },
  { slug: "beilagen-und-sauce", name: "Beilagen und Sauce", expected: 10 },
  { slug: "tacos", name: "Tacos", expected: 5 },
  { slug: "dessert", name: "Dessert", expected: 6 },
  { slug: "auflaeufe", name: "Aufläufe", expected: 5 },
  { slug: "reisgerichte", name: "Reisgerichte", expected: 3 },
  { slug: "indisches", name: "Indisches", expected: 10 },
  { slug: "gyros", name: "Gyros", expected: 5 },
  { slug: "doenergerichte", name: "Dönergerichte", expected: 3 },
  { slug: "burger---fast-food-menue", name: "Burger - Fast food Menü", expected: 19 },
  { slug: "getraenke", name: "Getränke", expected: 13 },
];

const CATEGORY_IMAGES = {
  angebot: "image/data/kategorien/Sparmenue.jpg",
  "burger-und-fast-food": "image/data/images/Burger_icon.jpg",
  pizzen: "image/data/images/Pizza-icon.jpg",
  "american-pizza": "image/data/kategorien/American_Pizza.jpg",
  flammkuchen: "image/data/kategorien/flammkuchen.jpg",
  calzone: "image/data/images/Pizza-icon.jpg",
  pizzabroetchen: "image/data/images/Pizza-icon.jpg",
  Salate: "image/data/kategorien/Salat.jpg",
  putenschnitzel: "image/data/kategorien/Schnitzel.jpg",
  vorspeisen: "image/data/images/Menue_icon.jpg",
  pasta: "image/data/kategorien/Pasta.jpg",
  "al-forno": "image/data/kategorien/Al-Forno.jpg",
  "beilagen-und-sauce": "image/data/images/Menue_icon.jpg",
  tacos: "image/data/kategorien/Mexican.jpg",
  dessert: "image/data/images/Menue_icon.jpg",
  auflaeufe: "image/data/kategorien/Auflauf.jpg",
  reisgerichte: "image/data/kategorien/biryani.jpg",
  indisches: "image/data/kategorien/biryani.jpg",
  gyros: "image/data/images/Menue_icon.jpg",
  doenergerichte: "image/data/images/Menue_icon.jpg",
  "burger---fast-food-menue": "image/data/images/Burger_icon.jpg",
  getraenke: "image/data/images/Getraenk_icon.jpg",
};

function decodeBasic(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&euro;/gi, "€")
    .replace(/&auml;/gi, "ä")
    .replace(/&ouml;/gi, "ö")
    .replace(/&uuml;/gi, "ü")
    .replace(/&Auml;/gi, "Ä")
    .replace(/&Ouml;/gi, "Ö")
    .replace(/&Uuml;/gi, "Ü")
    .replace(/&szlig;/gi, "ß")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function textOf($, el) {
  return decodeBasic($(el).text());
}

function priceToCents(raw) {
  const match = String(raw).replace(/\s/g, "").match(/(\d+)[,.](\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 100 + Number(match[2]);
}

async function fetchText(url) {
  await mkdir(CACHE_DIR, { recursive: true });
  const cacheFile = path.join(CACHE_DIR, `${createHash("sha1").update(url).digest("hex")}.html`);
  try {
    const cached = await readFile(cacheFile, "utf8");
    if (cached.includes("products-table") || cached.includes("product_id") || cached.includes("Impressum") || cached.includes("select_address")) {
      return { status: 200, url, html: cached, cached: true };
    }
  } catch {
    // Cache miss is expected.
  }
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });
    const html = Buffer.from(await response.arrayBuffer()).toString("utf8");
    if (response.ok) await writeFile(cacheFile, html);
    return { status: response.status, url: response.url, html, cached: false };
  } catch (error) {
    return { status: 0, url, html: "", cached: false, error: String(error) };
  }
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

function parseCategory(html, category) {
  const $ = load(html);
  const countText = $(".pagination .results").first().text();
  const countMatch = countText.match(/von\s+(\d+)/i);
  const publishedCount = countMatch ? Number(countMatch[1]) : null;
  const headers = [];
  $("#products-table thead th").each((index, th) => {
    if (index < 2) return;
    const label = textOf($, $(th).find("div").eq(0));
    const detail = textOf($, $(th).find("div").eq(1));
    headers.push({ label: label === "Pries" || label === "preis" ? "Preis" : label, detail });
  });

  const products = [];
  $("#products-table tbody tr").each((_, tr) => {
    const cells = $(tr).children("td");
    if (cells.length < 3) return;
    const sku = textOf($, cells.eq(0));
    const name = textOf($, cells.eq(1).find(".name"));
    if (!sku || !name) return;
    const description = textOf($, cells.eq(1).find(".description"));
    const allergenCodes = textOf($, cells.eq(1).find("sup"));
    const variants = [];
    cells.slice(2).each((cellIndex, td) => {
      const header = headers[cellIndex] ?? { label: "Preis", detail: "" };
      const link = $(td).find("a").first();
      if (!link.length) return;
      const priceCents = priceToCents(link.text());
      if (priceCents == null) return;
      const onclick = link.attr("onclick") ?? "";
      const href = link.attr("href") ?? "";
      const cartMatch = onclick.match(/addToCart\(\s*'(\d+)'\s*,\s*'(\d+)'\s*\)/);
      const popupUrl = href.startsWith("http") ? href : href.startsWith("/") ? `${BASE}${href}` : "";
      variants.push({
        label: header.label,
        detail: header.detail,
        priceCents,
        sourceProductId: cartMatch ? cartMatch[1] : null,
        sourcePriceId: cartMatch ? cartMatch[2] : new URL(popupUrl, BASE).searchParams.get("prs"),
        popupUrl: popupUrl || null,
      });
    });
    products.push({
      sku,
      name,
      description,
      allergenCodes,
      categorySlug: category.slug,
      variants,
    });
  });

  return { publishedCount, products };
}

function parsePopup(html) {
  const $ = load(html);
  const title = textOf($, "#txttitle").replace(/\s+/g, " ").trim();
  const sizeLabel = textOf($, "#txttitle small");
  const productId = $("input[name='product_id']").attr("value") ?? null;
  const priceId = $("input[name='PriceId']").attr("value") ?? null;
  const priceMatch = html.match(/Preis:\s*(\d+,\d{2})/);
  const priceCents = priceMatch ? priceToCents(priceMatch[1]) : null;
  const description = textOf($, "#descinfo");
  const includedMatch = html.match(/var\s+extra_free\s*=\s*"(\d+)"/);
  const includedExtraCount = includedMatch ? Number(includedMatch[1]) : 0;

  const choiceGroups = [];
  $("input[name^='variant_parent_name']").each((_, input) => {
    const nameAttr = $(input).attr("name") ?? "";
    const keyMatch = nameAttr.match(/variant_parent_name(\[[^\]]+\]\[[^\]]+\])/);
    if (!keyMatch) return;
    const key = keyMatch[1];
    const groupName = $(input).attr("value") ?? textOf($, input);
    const container = $(input).parent().nextAll(".productvariant-class").first();
    const options = [];
    container.find("option").each((index, option) => {
      const value = $(option).attr("value") ?? "";
      const [label, price] = value.split("|||");
      if (!label) return;
      options.push({
        label: decodeBasic(label),
        priceCents: priceToCents(price ?? "0.00") ?? 0,
        sortOrder: index,
      });
    });
    container.find("input[type='radio']").each((index, radio) => {
      const value = $(radio).attr("value") ?? "";
      const [label, price] = value.split("|||");
      if (!label) return;
      options.push({
        label: decodeBasic(label),
        priceCents: priceToCents(price ?? "0.00") ?? 0,
        sortOrder: index,
      });
    });
    choiceGroups.push({
      sourceKey: key,
      name: decodeBasic(groupName),
      required: true,
      selectionType: container.find("select").length ? "SELECT" : "RADIO",
      sortOrder: choiceGroups.length,
      options,
    });
  });

  const extras = [];
  const extraPattern = /addextraitem\(\s*'(\d+)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*(\d+)\s*\)/g;
  let extraMatch;
  while ((extraMatch = extraPattern.exec(html))) {
    extras.push({
      sourceExtraId: extraMatch[1],
      name: decodeBasic(extraMatch[2]),
      priceCents: priceToCents(extraMatch[3]) ?? 0,
    });
  }

  return {
    title,
    sizeLabel,
    productId,
    priceId,
    priceCents,
    description,
    includedExtraCount,
    choiceGroups,
    extras,
  };
}

function stripPage(html) {
  const $ = load(html);
  $("script, style, noscript").remove();
  const heading = $("h1").first().text().trim();
  const content = $("#content").text().replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { heading, content };
}

async function downloadFile(urlPath, destination) {
  try {
    await readFile(destination);
    return true;
  } catch {
    // Download when the image is not already on disk.
  }
  try {
    const response = await fetch(urlPath.startsWith("http") ? urlPath : `${BASE}/${urlPath}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/*,*/*",
      },
    });
    if (!response.ok) return false;
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(destination, buffer);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(IMAGE_DIR, { recursive: true });

  const warnings = [];
  const popupJobs = [];
  const categories = [];
  const products = [];

  for (const category of CATEGORIES) {
    const page = await fetchText(`${BASE}/${category.slug}`);
    if (page.status !== 200) {
      warnings.push({ type: "category-fetch", slug: category.slug, status: page.status });
      continue;
    }
    const parsed = parseCategory(page.html, category);
    if (parsed.publishedCount !== category.expected) {
      warnings.push({
        type: "count-mismatch",
        slug: category.slug,
        expected: category.expected,
        published: parsed.publishedCount,
        parsed: parsed.products.length,
      });
    }
    if (parsed.products.length !== parsed.publishedCount) {
      warnings.push({
        type: "parse-mismatch",
        slug: category.slug,
        published: parsed.publishedCount,
        parsed: parsed.products.length,
      });
    }
    const imageSource = CATEGORY_IMAGES[category.slug];
    const imageFile = `${category.slug}.jpg`;
    const saved = await downloadFile(imageSource, path.join(IMAGE_DIR, imageFile));
    categories.push({
      slug: category.slug,
      name: parsed.products.length ? category.name : category.name,
      sourceName: category.name,
      publishedCount: parsed.publishedCount,
      image: saved ? `/images/original/${imageFile}` : null,
      imageSource: `${BASE}/${imageSource}`,
      sortOrder: categories.length,
    });
    for (const product of parsed.products) {
      const record = {
        sku: product.sku,
        name: product.name,
        description: product.description,
        allergenCodes: product.allergenCodes,
        categorySlug: category.slug,
        isOffer: category.slug === "angebot",
        variants: product.variants.map((variant, sortOrder) => ({
          ...variant,
          sortOrder,
          includedExtraCount: 0,
          choiceGroups: [],
          extras: [],
        })),
      };
      products.push(record);
      record.variants.forEach((variant, variantIndex) => {
        if (variant.popupUrl) {
          popupJobs.push({ product: record, variantIndex, url: variant.popupUrl });
        }
      });
    }
    console.log(`${category.slug}: ${parsed.products.length}/${parsed.publishedCount}`);
  }

  console.log(`Fetching ${popupJobs.length} product popups...`);
  let done = 0;
  await mapPool(popupJobs, 6, async (job) => {
    try {
      const page = await fetchText(job.url);
      if (page.status !== 200 || !page.html.includes("product_id")) {
        warnings.push({ type: "popup-fetch", url: job.url, status: page.status });
        return;
      }
      const popup = parsePopup(page.html);
      const variant = job.product.variants[job.variantIndex];
      variant.sourceProductId = popup.productId ?? variant.sourceProductId;
      variant.sourcePriceId = popup.priceId ?? variant.sourcePriceId;
      if (popup.priceCents != null && popup.priceCents !== variant.priceCents) {
        warnings.push({
          type: "price-mismatch",
          sku: job.product.sku,
          url: job.url,
          listPrice: variant.priceCents,
          popupPrice: popup.priceCents,
        });
      }
      variant.sizeLabelFromPopup = popup.sizeLabel;
      variant.includedExtraCount = popup.includedExtraCount;
      variant.choiceGroups = popup.choiceGroups;
      variant.extras = popup.extras;
      if (popup.description && popup.description.length > (job.product.description?.length ?? 0)) {
        job.product.description = popup.description;
      }
    } catch (error) {
      warnings.push({ type: "popup-error", url: job.url, message: String(error) });
    } finally {
      done += 1;
      if (done % 25 === 0 || done === popupJobs.length) {
        console.log(`popups ${done}/${popupJobs.length}`);
      }
    }
  });

  const home = await fetchText(`${BASE}/`);
  const $home = load(home.html);
  const areas = [];
  $home("input[name='select_address']").each((_, input) => {
    const value = $home(input).attr("value") ?? "";
    const [postalCode, locality, externalId, minimum] = value.split("|");
    areas.push({
      postalCode,
      locality,
      externalId,
      minimumOrderCents: Math.round(Number(minimum) * 100),
      deliveryFeeCents: null,
    });
  });

  const hours = [];
  const dayMap = {
    Montag: "MONDAY",
    Dienstag: "TUESDAY",
    Mittwoch: "WEDNESDAY",
    Donnerstag: "THURSDAY",
    Freitag: "FRIDAY",
    Samstag: "SATURDAY",
    Sonntag: "SUNDAY",
    Feiertag: "HOLIDAY",
  };
  $home("table tr").each((_, tr) => {
    const cells = $home(tr).find("td");
    if (cells.length < 3) return;
    const dayLabel = textOf($home, cells.eq(0));
    const day = dayMap[dayLabel];
    if (!day) return;
    const range = textOf($home, cells.eq(2));
    const match = range.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
    if (!match) return;
    if (hours.some((entry) => entry.day === day)) return;
    hours.push({ day, label: dayLabel, opens: match[1], closes: match[2] });
  });

  const legalPages = {
    impressum: "/impressum",
    agb: "/agb",
    datenschutz: "/Datenschutzerklaerung",
    allergene: "/Allergene-und-Zusatzstoffe",
  };
  const legal = {};
  for (const [key, urlPath] of Object.entries(legalPages)) {
    const page = await fetchText(`${BASE}${urlPath}`);
    legal[key] = { sourceUrl: `${BASE}${urlPath}`, status: page.status, ...stripPage(page.html) };
  }

  await downloadFile(`${BASE}/image/data/pizzablitz-oestringen-logo.png`, path.join(IMAGE_DIR, "logo.png"));

  const deals = await fetchText(`${BASE}/Deals-%20%20%20MO%20_%20FR`);
  const special = await fetchText(`${BASE}/special`);
  const kase = await fetchText(`${BASE}/Kasespatzle`);

  const restaurant = {
    legalName: "Snober Einzelunternehmen",
    tradeName: "Toni's Pizzablitz Östringen",
    publicName: "Pizza Blitz",
    ownerName: "Uzair Ahmad",
    street: "Kuhngasse 1",
    postalCode: "76684",
    city: "Östringen",
    country: "Deutschland",
    phone: "07253 26560",
    phoneInternational: "+49 7253 26560",
    fax: "072532789814",
    faxInternational: "+49 7253 2789814",
    email: null,
    website: "https://www.pizzablitz.online/",
    facebookUrl: "https://www.facebook.com/Pizza-Blitz-%C3%B6stringen-136650623797749/",
    latitude: 49.2187392,
    longitude: 8.7126137,
    logo: "/images/original/logo.png",
    yearsClaim: "Seit 26 Jahre in Östringen",
    timezone: "Europe/Berlin",
    pickupMinimumCents: 0,
    announcement: {
      active: true,
      phoneOnly: true,
      minimumOrderCents: 3500,
      title: "Gratis-Artikel bei telefonischer Bestellung",
      body: "Bei Anruf und einem Mindestbestellwert ab 35€ gibt es als Gratisartikel Spaghetti Eis oder Cola 1L nach Wahl. Dieses Angebot gilt laut der aktuellen Website nur bei Anruf und wird nicht automatisch im Warenkorb abgezogen.",
    },
  };

  const report = {
    extractedAt: new Date().toISOString(),
    source: BASE,
    categories: categories.length,
    products: products.length,
    variants: products.reduce((sum, product) => sum + product.variants.length, 0),
    popupsFetched: popupJobs.length,
    deliveryAreas: areas.length,
    warnings,
    missing: [
      { item: "Deals Mo–Fr", detail: `Category URL returned HTTP ${deals.status}. Products were not invented.` },
      { item: "Käsespätzle category", detail: `https://www.pizzablitz.online/Kasespatzle returned HTTP ${kase.status}.` },
      { item: "Restaurant email", detail: "Impressum refers to an email address, but none is published." },
      { item: "Delivery fee", detail: "Only minimum order values are published. deliveryFeeCents is null." },
      { item: "Pickup minimum", detail: "No separate pickup minimum is published. Stored as 0 because the site shows 0,00€ before an area is chosen." },
      { item: "Allergen letter legend", detail: "Product codes such as A, C, G and A1 are published, but the allergen page does not define the letters." },
      { item: "Drink deposit", detail: "Pfand appears in drink descriptions. It is not added as a separate cart charge." },
      { item: "Angebot 1 cheese crust", detail: "Description says 4€. The extra button on the product popup is the price used for ordering." },
      { item: "Online payment credentials", detail: "AGB lists card, PayPal and Sofort. No credentials are available." },
      { item: "Holiday calendar", detail: "Holiday hours are published, but no list of holidays is published." },
      { item: "Reviews", detail: "No verifiable customer reviews were found." },
    ],
    specialPageStatus: special.status,
    inaccessible: ["Customer payment checkout could not be completed without placing an order.", "Deals Mo–Fr category is blocked by the host firewall."],
  };

  await writeFile(path.join(DATA_DIR, "restaurant.json"), JSON.stringify(restaurant, null, 2));
  await writeFile(path.join(DATA_DIR, "categories.json"), JSON.stringify(categories, null, 2));
  await writeFile(path.join(DATA_DIR, "products.json"), JSON.stringify(products, null, 2));
  await writeFile(path.join(DATA_DIR, "offers.json"), JSON.stringify(products.filter((product) => product.isOffer), null, 2));
  await writeFile(path.join(DATA_DIR, "delivery-areas.json"), JSON.stringify(areas, null, 2));
  await writeFile(path.join(DATA_DIR, "opening-hours.json"), JSON.stringify(hours, null, 2));
  await writeFile(path.join(DATA_DIR, "allergens.json"), JSON.stringify(legal.allergene, null, 2));
  await writeFile(path.join(DATA_DIR, "legal-information.json"), JSON.stringify(legal, null, 2));
  await writeFile(path.join(DATA_DIR, "extraction-report.json"), JSON.stringify(report, null, 2));

  console.log(JSON.stringify({ products: products.length, categories: categories.length, warnings: warnings.length, areas: areas.length }, null, 2));
  if (products.length !== 236) {
    console.error(`Expected 236 products, parsed ${products.length}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
