import { getAuthUser } from "@/server/auth/guard";
import { handle, json } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/auth/me — current administrator session (null when signed out). */
export async function GET() {
  return handle(async () => {
    const user = await getAuthUser();
    return json({
      user: user
        ? { id: user.id, name: user.name, email: user.email, roles: user.roles, permissions: [...user.permissions], mustChangePassword: user.mustChangePassword }
        : null,
    });
  });
}
