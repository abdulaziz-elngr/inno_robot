import { z } from "zod";
import { buildingSchema } from "@/lib/validation/admin";
import { assertSameOrigin, requireUser, ApiError } from "@/server/auth/guard";
import { updateBuilding } from "@/server/services/locations";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().trim().min(1).max(64) });

async function idFromReq(req: Request): Promise<string> {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).at(-1);
  if (!id) throw new ApiError(400, "Missing building id.", "MISSING_ID");
  return paramsSchema.parse({ id }).id;
}

/** PATCH /api/admin/buildings/[id] */
export async function PATCH(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("locations.manage");
    const input = await readJson(req, buildingSchema.partial());
    await updateBuilding(await idFromReq(req), input, user.id);
    return json({ ok: true });
  });
}
