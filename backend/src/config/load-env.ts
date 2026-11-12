import { readFileSync } from "node:fs";
import path from "node:path";

const file = path.resolve(process.cwd(), ".env");
try {
  const text = readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    if (process.env[key] === undefined) process.env[key] = match[2].trim();
  }
} catch {
  // A missing .env is reported by the environment schema.
}
