import fs from "node:fs";
import path from "node:path";

/** Minimal .env loader so tsx scripts behave like `next dev` (no extra dependency). */
export function loadEnv(): void {
  for (const file of [".env", ".env.local"]) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) continue;
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      let value = match[2] ?? "";
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[match[1]!] === undefined) process.env[match[1]!] = value;
    }
  }
}
