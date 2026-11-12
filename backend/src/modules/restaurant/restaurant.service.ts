import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../utils/http.js";

async function readJson<T>(name: string): Promise<T> {
  const file = path.resolve(process.cwd(), env.DATA_DIR, name);
  return JSON.parse(await readFile(file, "utf8")) as T;
}

export async function getRestaurant() {
  const restaurant = await prisma.restaurant.findFirst({ include: { hours: true } });
  if (!restaurant) throw new HttpError(503, "Restaurantdaten sind noch nicht geladen.", "NOT_READY");
  const promotion = await prisma.promotion.findUnique({ where: { slug: "phone-gift" } });
  return {
    ...restaurant,
    hours: restaurant.hours,
    announcement: promotion,
  };
}

export function cleanLegalContent(heading: string, content: string) {
  const withoutFooter = content.split(/Mein Konto/i)[0] ?? content;
  const first = withoutFooter.indexOf(heading);
  const second = first >= 0 ? withoutFooter.indexOf(heading, first + heading.length) : -1;
  const sliced = (second >= 0 ? withoutFooter.slice(second) : first >= 0 ? withoutFooter.slice(first) : withoutFooter).trim();
  return sliced.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

export async function getLegal(page: "impressum" | "agb" | "datenschutz" | "allergene") {
  const legal = await readJson<Record<string, { heading: string; content: string; sourceUrl: string }>>("legal-information.json");
  const entry = legal[page];
  if (!entry) throw new HttpError(404, "Seite nicht gefunden.", "NOT_FOUND");
  return { ...entry, content: cleanLegalContent(entry.heading, entry.content) };
}
