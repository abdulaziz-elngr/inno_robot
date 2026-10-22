import { z } from "zod";
import { assertSameOrigin, requireUser, ApiError } from "@/server/auth/guard";
import { deleteAsset } from "@/server/services/media";
import { handle, json } from "@/server/http";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().trim().min(1).max(64) });

async function idFromReq(req: Request): Promise<string> {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).at(-1);
  if (!id) throw new ApiError(400, "Missing asset id.", "MISSING_ID");
  return paramsSchema.parse({ id }).id;
}

/** DELETE /api/admin/media/[id] — removes the DB record (Cloudinary deletion is documented in HARDWARE/DEPLOYMENT). */
export async function DELETE(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("media.manage");
    await deleteAsset(await idFromReq(req), user.id);
    return json({ ok: true });
  });
}
