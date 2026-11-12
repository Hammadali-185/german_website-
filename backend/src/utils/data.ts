import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

export async function readDataFile<T>(name: string): Promise<T> {
  const file = path.resolve(process.cwd(), env.DATA_DIR, name);
  return JSON.parse(await readFile(file, "utf8")) as T;
}
