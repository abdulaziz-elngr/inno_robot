import path from "node:path";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { database } from "./client";

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

/**
 * Applies the SQL migrations in ./drizzle.
 *  - production: runs against DIRECT_URL (or DATABASE_URL) — never at application startup;
 *    it is an explicit `npm run db:migrate` step in the deployment pipeline.
 *  - local development: applies to the embedded PGlite database.
 */
export async function runMigrations(folder: string = MIGRATIONS_FOLDER): Promise<void> {
  if (database.kind === "pg") {
    await migratePg(database.db as unknown as Parameters<typeof migratePg>[0], { migrationsFolder: folder });
  } else {
    await migratePglite(database.db as unknown as Parameters<typeof migratePglite>[0], { migrationsFolder: folder });
  }
}
