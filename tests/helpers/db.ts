import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { db as embeddedDb } from "@/server/db/client";

/**
 * Test database bootstrap.
 *
 * Every suite gets its own embedded PostgreSQL (PGlite) directory under the OS temp
 * dir, so tests never touch the development database in .data/pglite. SQLite is never
 * used anywhere in the platform.
 *
 * Import this module BEFORE any module that touches `@/server/db/client`.
 */

const uniqueDir = path.join(os.tmpdir(), `inno-robot-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
fs.mkdirSync(uniqueDir, { recursive: true });

process.env.EMBEDDED_DB_DIR = uniqueDir;
process.env.DEVICE_AUTH_SECRET ??= "test-device-auth-secret";
process.env.AUTH_SECRET ??= "test-auth-secret";
// Never let a test run hit a real Neon instance by accident.
delete process.env.DATABASE_URL;

type Db = typeof embeddedDb;

let dbPromise: Promise<Db> | null = null;

/** Applies the SQL migrations to the suite's isolated embedded database. */
export async function initTestDb(): Promise<Db> {
  dbPromise ??= (async () => {
    const { runMigrations } = await import("@/server/db/migrate");
    await runMigrations();
    const { db } = await import("@/server/db/client");
    return db;
  })();
  return dbPromise;
}

/** Removes the suite's temporary database directory (best effort). */
export function cleanupTestDb(): void {
  try {
    fs.rmSync(uniqueDir, { recursive: true, force: true });
  } catch {
    /* the OS will reclaim it */
  }
}

/** Small unique helper so seeded rows never collide across tests in one file. */
export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}
