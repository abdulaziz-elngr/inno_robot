import { registerDeviceSchema } from "@/lib/validation/admin";
import { z } from "zod";
import { assertSameOrigin, requireUser } from "@/server/auth/guard";
import { listDevices, registerDevice } from "@/server/services/devices";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["ONLINE", "OFFLINE", "IDLE", "BUSY", "MOVING", "CHARGING", "ERROR", "MAINTENANCE"]).optional(),
  active: z.enum(["true", "false"]).optional(),
});

/** GET /api/admin/robots */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser("devices.read");
    const query = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    const rows = await listDevices({ q: query.q, status: query.status, active: query.active === undefined ? undefined : query.active === "true" });
    return json({ rows });
  });
}

/** POST /api/admin/robots — register a device; the secret is returned exactly once. */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("devices.manage");
    const input = await readJson(req, registerDeviceSchema);
    const result = await registerDevice(input, user.id);
    return json({ ok: true, ...result, note: "Copy this secret now — it is never shown again." }, { status: 201 });
  });
}
