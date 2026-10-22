import { eq } from "drizzle-orm";
import { ApiError } from "@/server/auth/guard";
import { assertPasswordStrength, hashPassword, verifyPassword } from "@/server/auth/password";
import { loginLimiter, resetLimiter } from "@/server/auth/rate-limit";
import { createSession, destroySession, requestMeta, revokeAllSessions } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { passwordResetTokens, users } from "@/server/db/schema";
import { createHash, randomBytes } from "node:crypto";
import { audit } from "./audit";
import { sendPasswordResetEmail } from "@/server/email";

/** A fixed hash compared when the account does not exist, to keep response times uniform. */
const DUMMY_HASH_PROMISE = hashPassword("timing-equalizer-password-000");

export type LoginResult = { ok: true } | { ok: false; code: "INVALID_CREDENTIALS" | "RATE_LIMITED" | "INACTIVE" };

/**
 * Password login for administrators. Rate limited, generic failure messages (no user
 * enumeration), audited on both success and failure.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const meta = await requestMeta();
  const key = `${email}|${meta.ip ?? "unknown"}`;
  const limit = loginLimiter.check(key);
  if (!limit.ok) {
    await audit({ actorLabel: "anonymous", action: "auth.login.rate_limited", metadata: { email }, ip: meta.ip });
    return { ok: false, code: "RATE_LIMITED" };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
  const stored = user?.passwordHash ?? (await DUMMY_HASH_PROMISE);
  const valid = await verifyPassword(password, stored);

  if (!user || !valid) {
    await audit({ actorLabel: user ? user.email : "unknown", action: "auth.login.failed", ip: meta.ip, metadata: { email } });
    return { ok: false, code: "INVALID_CREDENTIALS" };
  }
  if (!user.active) {
    await audit({ actorUserId: user.id, actorLabel: user.email, action: "auth.login.inactive", ip: meta.ip });
    return { ok: false, code: "INACTIVE" };
  }

  await createSession(user.id, { ip: meta.ip, userAgent: meta.userAgent });
  await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
  await audit({ actorUserId: user.id, actorLabel: user.email, action: "auth.login.success", ip: meta.ip });
  return { ok: true };
}

export async function logout(): Promise<void> {
  const meta = await requestMeta();
  await destroySession();
  await audit({ actorLabel: "admin", action: "auth.logout", ip: meta.ip });
}

/**
 * Starts password recovery. The response is identical whether or not the account exists.
 * Without an email provider configured the reset link is written to the server console
 * (documented development behaviour — see docs/DEPLOYMENT.md).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const meta = await requestMeta();
  const limit = resetLimiter.check(meta.ip ?? "unknown");
  if (!limit.ok) throw new ApiError(429, "Too many reset requests. Try again later.", "RESET_RATE_LIMITED");

  const normalized = email.toLowerCase().trim();
  const [user] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  if (!user || !user.active) return; // no enumeration

  const token = randomBytes(32).toString("base64url");
  await db.insert(passwordResetTokens).values({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + 60 * 60_000), // 1 hour
  });

  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const url = `${base}/reset-password?token=${token}`;
  await sendPasswordResetEmail(user.email, url, user.name);
  await audit({ actorUserId: user.id, actorLabel: user.email, action: "auth.password_reset_requested", ip: meta.ip });
}

/** Consumes a single-use token and sets a new password (all sessions are revoked). */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const strengthError = assertPasswordStrength(newPassword);
  if (strengthError) throw new ApiError(400, strengthError, "PASSWORD_TOO_WEAK");

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash)).limit(1);
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, "This reset link is invalid or has expired.", "RESET_TOKEN_INVALID");
  }

  const password = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: password, mustChangePassword: false, updatedAt: new Date() }).where(eq(users.id, row.userId));
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));
  });
  await revokeAllSessions(row.userId);
  await audit({ actorLabel: "admin", action: "auth.password_reset_completed", targetType: "user", targetId: row.userId });
}

/** Changes the signed-in user's own password. */
export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw new ApiError(400, "Current password is incorrect.", "PASSWORD_INVALID");
  const strengthError = assertPasswordStrength(newPassword);
  if (strengthError) throw new ApiError(400, strengthError, "PASSWORD_TOO_WEAK");
  await db.update(users).set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false, updatedAt: new Date() }).where(eq(users.id, userId));
  await revokeAllSessions(userId);
  await audit({ actorUserId: userId, actorLabel: user.email, action: "auth.password_changed" });
}
