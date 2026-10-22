import { assertSameOrigin } from "@/server/auth/guard";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { requestPasswordReset } from "@/server/services/auth";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

/** POST /api/auth/forgot — always answers 200 to avoid account enumeration. */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const input = await readJson(req, forgotPasswordSchema);
    await requestPasswordReset(input.email);
    return json({ ok: true });
  });
}
