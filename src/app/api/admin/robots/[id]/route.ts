import { z } from "zod";
import { updateDeviceSchema } from "@/lib/validation/admin";
import { assertSameOrigin, requireUser, ApiError } from "@/server/auth/guard";
import { getDeviceDetail, updateDevice } from "@/server/services/devices";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().trim().min(1).max(64) });

async function idFromReq(req: Request): Promise<string> {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).at(-1);
  if (!id) throw new ApiError(400, "Missing device id.", "MISSING_ID");
  return paramsSchema.parse({ id }).id;
}

/** GET /api/admin/robots/[id] — device detail: credential meta, events, telemetry, commands. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser("devices.read");
    return json(await getDeviceDetail(await idFromReq(req)));
  });
}

/** PATCH /api/admin/robots/[id] — settings + activation. */
export async function PATCH(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("devices.manage");
    const input = await readJson(req, updateDeviceSchema);
    await updateDevice(await idFromReq(req), input, user.id);
    return json({ ok: true });
  });
}
