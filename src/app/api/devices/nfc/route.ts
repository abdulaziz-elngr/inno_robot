import { nfcEventSchema } from "@/lib/validation/nfc";
import { verifyDeviceRequest } from "@/server/auth/device-auth";
import { ingestNfcEvent } from "@/server/services/nfc";
import { handle, json, readJson, readRawBody } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * ESP32 / simulator NFC ingestion.
 * The device posts every detected card; the backend deduplicates, resolves the
 * card (active / revoked / unknown), identifies the student and answers with a
 * bilingual, terminal-renderable result. Responds 200 even for rejected cards so
 * the terminal can display the message and keep scanning.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const raw = await readRawBody(req);
    const event = await readJson(req, nfcEventSchema);
    const device = await verifyDeviceRequest(req, raw);
    const result = await ingestNfcEvent(device, event);
    return json(result);
  });
}
