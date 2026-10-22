import fs from "node:fs";
import path from "node:path";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";

/**
 * Runtime database selection:
 *  - `DATABASE_URL` set  -> real PostgreSQL (Neon in production; the pooled endpoint for
 *    runtime queries, `DIRECT_URL` for migrations — see scripts/migrate.ts).
 *  - `DATABASE_URL` empty -> embedded PostgreSQL (PGlite) in .data/pglite, development only.
 *
 * SQLite is never used: the schema, SQL migrations and queries are PostgreSQL end to end.
 */
function create() {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: process.env.DATABASE_SSL === "disable" ? false : undefined,
    });
    // A single idle client erroring (database restart) must not crash the process.
    pool.on("error", (err) => console.error("[db] idle client error:", err.message));
    return { kind: "pg" as const, db: drizzlePg(pool, { schema }) };
  }
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build" && process.env.ALLOW_EMBEDDED_DB !== "1") {
    throw new Error(
      "DATABASE_URL is required in production: the embedded development database is not allowed (set ALLOW_EMBEDDED_DB=1 only to try a production build locally).",
    );
  }
  const dir = process.env.EMBEDDED_DB_DIR ? path.resolve(process.env.EMBEDDED_DB_DIR) : path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  return { kind: "pglite" as const, db: drizzlePglite(client, { schema }) };
}

const g = globalThis as unknown as { __innoRobotDb?: ReturnType<typeof create> };
export const database = (g.__innoRobotDb ??= create());
export const db = database.db as ReturnType<typeof drizzlePg<typeof schema>>;

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Either the shared client or an open transaction, so services can run inside either. */
export type Executor = typeof db | Tx;

/** True when queries run against the embedded development database. */
export const isEmbedded = () => database.kind === "pglite";
