import { z } from "zod";
import { assertSameOrigin, requireUser, ApiError } from "@/server/auth/guard";
import { revokeDeviceCredential } from "@/server/services/devices";
import { handle, json } from "@/server/http";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().trim().min(1).max(64) });

async function idFromReq(req: Request): Promise<string> {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).at(-2);
  if (!id) throw new ApiError(400, "Missing device id.", "MISSING_ID");
  return paramsSchema.parse({ id }).id;
}

/** POST /api/admin/robots/[id]/revoke — device can no longer authenticate (revocation is not deletion). */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("devices.manage");
    await revokeDeviceCredential(await idFromReq(req), user.id);
    return json({ ok: true });
  });
}
