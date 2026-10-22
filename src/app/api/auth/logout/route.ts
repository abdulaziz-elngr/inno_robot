import { assertSameOrigin } from "@/server/auth/guard";
import { logout } from "@/server/services/auth";
import { handle, json } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    await logout();
    return json({ ok: true });
  });
}
