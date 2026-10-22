import { telemetrySchema } from "@/lib/validation/commands";
import { verifyDeviceRequest } from "@/server/auth/device-auth";
import { recordTelemetry } from "@/server/services/devices";
import { handle, json, readJson, readRawBody } from "@/server/http";

export const dynamic = "force-dynamic";

/** Telemetry ingestion (battery, speed, obstacle distance, mode, status). */
export async function POST(req: Request) {
  return handle(async () => {
    const raw = await readRawBody(req);
    const payload = await readJson(req, telemetrySchema);
    const device = await verifyDeviceRequest(req, raw);
    await recordTelemetry(device.deviceId, payload, device.simulated);
    return json({ ok: true, receivedAt: new Date().toISOString() });
  });
}
