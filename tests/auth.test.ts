import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestDb, initTestDb, uid } from "./helpers/db";

/**
 * Authentication unit tests: password policy + argon2id hashing, and the
 * server-enforced role/permission model used by every admin route.
 */

describe("password policy", () => {
  it("rejects passwords that are too short or missing a class", async () => {
    const { assertPasswordStrength } = await import("@/server/auth/password");
    expect(assertPasswordStrength("short1A")).toMatch(/at least 12/);
    expect(assertPasswordStrength("123456789012")).toMatch(/letter/);
    expect(assertPasswordStrength("NoNumbersHereAtAll")).toMatch(/number/);
  });

  it("accepts a strong password", async () => {
    const { assertPasswordStrength } = await import("@/server/auth/password");
    expect(assertPasswordStrength("InnoRobot#2026")).toBeNull();
  });
});

describe("argon2id hashing", () => {
  it("produces a verifiable argon2id PHC string that never contains the plaintext", async () => {
    const { hashPassword, verifyPassword } = await import("@/server/auth/password");
    const stored = await hashPassword("InnoRobot#2026");

    expect(stored.startsWith("$argon2id$")).toBe(true);
    expect(stored).not.toContain("InnoRobot");

    expect(await verifyPassword("InnoRobot#2026", stored)).toBe(true);
    expect(await verifyPassword("InnoRobot#2027", stored)).toBe(false);
  });

  it("returns false for malformed or non-argon2 hashes instead of throwing", async () => {
    const { verifyPassword } = await import("@/server/auth/password");
    expect(await verifyPassword("anything", "")).toBe(false);
    expect(await verifyPassword("anything", "5f4dcc3b5aa765d61d8327deb882cf99")).toBe(false);
    expect(await verifyPassword("anything", "$argon2id$not-a-real-hash")).toBe(false);
  });
});

describe("card UID hashing", () => {
  it("normalizes, hashes irreversibly and keeps only the last 4 for support", async () => {
    const { hashCardUid, normalizeUid, uidLast4 } = await import("@/server/services/students");

    expect(normalizeUid("  04a1b2c3d4e5f6  ")).toBe("04A1B2C3D4E5F6");
    expect(uidLast4("04A1B2C3D4E5F6")).toBe("E5F6");

    const hash = hashCardUid("04A1B2C3D4E5F6");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("04A1B2");
    // Same UID (any case/spacing) → same hash; different UID → different hash.
    expect(hashCardUid("04a1b2c3d4e5f6")).toBe(hash);
    expect(hashCardUid("04A1B2C3D4E5F7")).not.toBe(hash);
  });
});

describe("permissions catalogue", () => {
  it("covers every capability the admin console gates on", async () => {
    const { ALL_PERMISSIONS, PERMISSIONS } = await import("@/lib/permissions");
    for (const value of Object.values(PERMISSIONS)) {
      expect(ALL_PERMISSIONS).toContain(value);
      expect(value).toMatch(/^[a-z]+\.[a-z]+$/);
    }
    // Spot-check the safety-critical ones exist and are distinct.
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
    expect(PERMISSIONS.commandsStop).toBe("commands.stop");
    expect(PERMISSIONS.commandsIssue).toBe("commands.issue");
    expect(PERMISSIONS.devicesManage).toBe("devices.manage");
  });

  it("keeps roles.manage exclusive to SUPER_ADMIN (no escalation path for ADMIN)", async () => {
    const { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } = await import("@/lib/permissions");
    expect(DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN).toContain(PERMISSIONS.rolesManage);
    expect(DEFAULT_ROLE_PERMISSIONS.ADMIN).not.toContain(PERMISSIONS.rolesManage);
  });

  it("never grants write/manage permissions to VIEWER", async () => {
    const { DEFAULT_ROLE_PERMISSIONS } = await import("@/lib/permissions");
    for (const permission of DEFAULT_ROLE_PERMISSIONS.VIEWER) {
      expect(permission).toMatch(/\.read$/);
    }
  });

  it("gives SUPER_ADMIN the entire catalogue", async () => {
    const { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } = await import("@/lib/permissions");
    expect(new Set(DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN)).toEqual(new Set(ALL_PERMISSIONS));
  });
});

describe("session lifecycle against the database", () => {
  let db: Awaited<ReturnType<typeof initTestDb>>;
  let userId: string;

  beforeAll(async () => {
    db = await initTestDb();
    const { hashPassword } = await import("@/server/auth/password");
    const { users } = await import("@/server/db/schema");
    userId = uid("user");
    await db.insert(users).values({
      id: userId,
      email: `${userId.toLowerCase()}@test.local`,
      name: "Test Admin",
      passwordHash: await hashPassword("InnoRobot#2026"),
      active: true,
    });
  });

  afterAll(cleanupTestDb);

  /**
   * Mirrors the lookup `getAuthUser` performs (same predicates). The route-level
   * cookie plumbing lives in Next.js and is covered by the smoke test instead.
   */
  async function findSession(token: string) {
    const { createHash } = await import("node:crypto");
    const { and, eq, gt, isNull } = await import("drizzle-orm");
    const { sessions, users } = await import("@/server/db/schema");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const [row] = await db
      .select({ id: users.id, active: users.active, revokedAt: sessions.revokedAt, expiresAt: sessions.expiresAt })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date()), isNull(sessions.revokedAt)))
      .limit(1);
    if (!row || !row.active) return null;
    return row;
  }

  async function insertSession(token: string, expiresAt: Date) {
    const { createHash } = await import("node:crypto");
    const { sessions } = await import("@/server/db/schema");
    await db.insert(sessions).values({
      id: crypto.randomUUID(),
      userId,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt,
    });
  }

  it("resolves a live session by its token hash", async () => {
    const token = `tok-${crypto.randomUUID()}`;
    await insertSession(token, new Date(Date.now() + 3_600_000));
    expect(await findSession(token)).not.toBeNull();
  });

  it("never resolves an expired session", async () => {
    const token = `tok-${crypto.randomUUID()}`;
    await insertSession(token, new Date(Date.now() - 1_000));
    expect(await findSession(token)).toBeNull();
  });

  it("revokeAllSessions invalidates every live session of that user", async () => {
    const { revokeAllSessions } = await import("@/server/auth/session");
    const a = `tok-${crypto.randomUUID()}`;
    const b = `tok-${crypto.randomUUID()}`;
    await insertSession(a, new Date(Date.now() + 3_600_000));
    await insertSession(b, new Date(Date.now() + 3_600_000));
    expect(await findSession(a)).not.toBeNull();
    expect(await findSession(b)).not.toBeNull();

    await revokeAllSessions(userId);

    expect(await findSession(a)).toBeNull();
    expect(await findSession(b)).toBeNull();
  });

  it("does not resolve a session after the user is deactivated", async () => {
    const { users } = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");
    const token = `tok-${crypto.randomUUID()}`;
    await insertSession(token, new Date(Date.now() + 3_600_000));
    expect(await findSession(token)).not.toBeNull();

    await db.update(users).set({ active: false }).where(eq(users.id, userId));
    expect(await findSession(token)).toBeNull();

    await db.update(users).set({ active: true }).where(eq(users.id, userId));
    expect(await findSession(token)).not.toBeNull();
  });
});
