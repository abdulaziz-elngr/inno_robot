import { z } from "zod";
import { locationSchema } from "@/lib/validation/admin";
import { assertSameOrigin, requireUser, ApiError } from "@/server/auth/guard";
import { deleteLocation, getLocationDetail, updateLocation } from "@/server/services/locations";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().trim().min(1).max(64) });

async function idFromReq(req: Request): Promise<string> {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).at(-1);
  if (!id) throw new ApiError(400, "Missing location id.", "MISSING_ID");
  return paramsSchema.parse({ id }).id;
}

/** GET /api/admin/locations/[id] */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser("locations.manage");
    return json(await getLocationDetail(await idFromReq(req)));
  });
}

/** PATCH /api/admin/locations/[id] */
export async function PATCH(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("locations.manage");
    const input = await readJson(req, locationSchema);
    await updateLocation(await idFromReq(req), input, user.id);
    return json({ ok: true });
  });
}

/** DELETE /api/admin/locations/[id] */
export async function DELETE(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("locations.manage");
    await deleteLocation(await idFromReq(req), user.id);
    return json({ ok: true });
  });
}
