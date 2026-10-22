import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/server/db/client";
import { sessions, users } from "@/server/db/schema";
import { type Access, loadAccessCached } from "./rbac";

export const SESSION_COOKIE = "inno_session";
const SESSION_HOURS = Number(process.env.SESSION_HOURS ?? 720);

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type SessionUser = Access & {
  id: string;
  email: string;
  name: string;
  locale: string;
  mustChangePassword: boolean;
};

export async function createSession(userId: string, meta?: { ip?: string | null; userAgent?: string | null }) {
  const token = randomBytes(32).toString("base64url");
  const jar = await cookies();
  // Housekeeping: drop expired sessions on login.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_HOURS * 3_600_000),
    ip: meta?.ip ?? null,
    userAgent: meta?.userAgent?.slice(0, 200) ?? null,
  });
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3_600,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

/** Revokes every session of a user (password change, account deactivation). */
export async function revokeAllSessions(userId: string) {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, userId));
}

/** Currently signed-in administrator, or null. Memoised per request. */
export const getAuthUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      locale: users.locale,
      active: users.active,
      mustChangePassword: users.mustChangePassword,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
        isNull(sessions.revokedAt),
      ),
    )
    .limit(1);

  if (!row || !row.active) return null;

  const access = await loadAccessCached(row.id);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    locale: row.locale,
    mustChangePassword: row.mustChangePassword,
    roles: access.roles,
    permissions: access.permissions,
  };
});

export async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
    userAgent: h.get("user-agent"),
  };
}
