import { z } from "zod";
import { assertSameOrigin, requireUser, ApiError } from "@/server/auth/guard";
import { deleteNavigationDestination } from "@/server/services/locations";
import { handle, json } from "@/server/http";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().trim().min(1).max(64) });

async function idFromReq(req: Request): Promise<string> {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).at(-1);
  if (!id) throw new ApiError(400, "Missing destination id.", "MISSING_ID");
  return paramsSchema.parse({ id }).id;
}

/** DELETE /api/admin/navigation/destinations/[id] */
export async function DELETE(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("navigation.manage");
    await deleteNavigationDestination(await idFromReq(req), user.id);
    return json({ ok: true });
  });
}
