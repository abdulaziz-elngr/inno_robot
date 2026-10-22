import { assertSameOrigin } from "@/server/auth/guard";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { resetPassword } from "@/server/services/auth";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const input = await readJson(req, resetPasswordSchema);
    await resetPassword(input.token, input.password);
    return json({ ok: true });
  });
}
