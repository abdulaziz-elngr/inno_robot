import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit generates SQL migration files without needing a live database.
 * Applying them (npm run db:migrate) uses:
 *   - DIRECT_URL (or DATABASE_URL) against Neon/PostgreSQL in production
 *   - an embedded PGlite database in .data/pglite for local development
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "postgres://local/embedded",
  },
});
