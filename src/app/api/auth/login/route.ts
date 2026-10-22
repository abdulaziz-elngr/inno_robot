import { assertSameOrigin, getAuthUser } from "@/server/auth/guard";
import { loginSchema } from "@/lib/validation/auth";
import { login } from "@/server/services/auth";
import { clientIp, handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

/** POST /api/auth/login — administrator sign-in (rate limited, generic errors). */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const input = await readJson(req, loginSchema);
    const result = await login(input.email, input.password);
    if (!result.ok) {
      const status = result.code === "RATE_LIMITED" ? 429 : 401;
      const message =
        result.code === "RATE_LIMITED"
          ? "Too many attempts. Please wait a few minutes."
          : result.code === "INACTIVE"
            ? "This account is deactivated."
            : "Email or password is incorrect.";
      return json({ error: message, code: result.code }, { status });
    }
    const user = await getAuthUser();
    return json({ ok: true, user: user ? { id: user.id, name: user.name, email: user.email, roles: user.roles } : null, ip: clientIp(req) });
  });
}
