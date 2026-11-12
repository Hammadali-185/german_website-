import { execFileSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://pizzablitz:pizzablitz@localhost:5432/pizzablitz";
}

execFileSync("npx", ["prisma", "generate"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
