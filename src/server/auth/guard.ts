import { redirect } from "next/navigation";
import type { PermissionKey } from "@/lib/permissions";
import { hasPermission } from "./rbac";
import { getAuthUser, type SessionUser } from "./session";

export { getAuthUser };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

/** Server-side guard for API route handlers. Throws 401/403 — never relies on hidden UI. */
export async function requireUser(permission?: PermissionKey): Promise<SessionUser> {
  const user = await getAuthUser();
  if (!user) throw new ApiError(401, "Authentication required.", "UNAUTHENTICATED");
  if (permission && !hasPermission(user, permission)) {
    throw new ApiError(403, "You do not have permission to perform this action.", "FORBIDDEN");
  }
  return user;
}

/** Server-side guard for pages/layouts: redirects to login when not signed in. */
export async function requireUserPage(permission?: PermissionKey, next?: string): Promise<SessionUser> {
  const user = await getAuthUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (permission && !hasPermission(user, permission)) redirect("/admin?denied=1");
  return user;
}

/**
 * CSRF protection for cookie-authenticated state-changing requests: the browser must
 * send an Origin/Referer matching APP_BASE_URL ( SameSite=Lax cookies are the second layer).
 */
export function assertSameOrigin(req: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const base = process.env.APP_BASE_URL?.replace(/\/$/, "");
  const source = origin ?? (referer ? new URL(referer).origin : null);
  if (!source) return; // same-origin fetches from some clients omit Origin; cookies remain SameSite.
  if (base && source !== base && source !== new URL(process.env.NEXT_PUBLIC_APP_BASE_URL ?? base).origin) {
    throw new ApiError(403, "Cross-origin request blocked.", "BAD_ORIGIN");
  }
}
