import { loadEnv } from "./lib/env";

loadEnv();

async function main() {
  const { runMigrations } = await import("../src/server/db/migrate");
  const { database } = await import("../src/server/db/client");
  const started = Date.now();
  console.log(`[migrate] applying migrations to ${database.kind === "pg" ? "PostgreSQL (DATABASE_URL/DIRECT_URL)" : "embedded PostgreSQL (.data/pglite)"} …`);
  await runMigrations();
  console.log(`[migrate] done in ${Date.now() - started}ms`);
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("[migrate] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
