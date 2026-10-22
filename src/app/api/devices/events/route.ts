import { z } from "zod";
import { verifyDeviceRequest } from "@/server/auth/device-auth";
import { recordDeviceEvent } from "@/server/services/devices";
import { handle, json, readJson, readRawBody } from "@/server/http";

export const dynamic = "force-dynamic";

const eventSchema = z.object({
  type: z.string().min(1).max(100),
  message: z.string().max(1000).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

/** Free-form device events (obstacle detected, motor fault, scan started, …). */
export async function POST(req: Request) {
  return handle(async () => {
    const raw = await readRawBody(req);
    const event = await readJson(req, eventSchema);
    const device = await verifyDeviceRequest(req, raw);
    await recordDeviceEvent(
      device.deviceId,
      event.type,
      { message: event.message, ...event.payload },
      device.simulated,
    );
    return json({ ok: true });
  });
}
