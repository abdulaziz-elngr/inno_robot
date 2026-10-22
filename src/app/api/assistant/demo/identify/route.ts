import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { demoIdentifySchema } from "@/lib/validation/nfc";
import { assertSameOrigin } from "@/server/auth/guard";
import { setStudentIdentification } from "@/server/auth/identification";
import { nfcLimiter } from "@/server/auth/rate-limit";
import { db } from "@/server/db/client";
import { robotDevices } from "@/server/db/schema";
import { ingestNfcEvent } from "@/server/services/nfc";
import { ApiError } from "@/server/auth/guard";
import { assertSimulationAllowed, handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/assistant/demo/identify — in-browser simulated NFC scan (development/demo).
 *
 * Clearly labelled as simulated: the event is ingested through the exact same service
 * as real hardware (dedupe, revoke checks, identification) but is attributed to a
 * registered *simulated* device so it can never be mistaken for a real scan.
 */
export async function POST(req: Request) {
  return handle(async () => {
    assertSimulationAllowed();
    assertSameOrigin(req);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = nfcLimiter.check(ip);
    if (!limit.ok) return json({ error: "Too many simulated scans. Please wait a moment.", code: "DEMO_RATE_LIMITED" }, { status: 429 });

    const input = await readJson(req, demoIdentifySchema);

    const [device] = await db
      .select()
      .from(robotDevices)
      .where(eq(robotDevices.simulated, true))
      .orderBy(asc(robotDevices.deviceId))
      .limit(1);
    if (!device) {
      throw new ApiError(409, "No simulated robot is registered. Run `npm run db:seed` first.", "SIM_DEVICE_MISSING");
    }

    const result = await ingestNfcEvent(
      { deviceId: device.deviceId, displayName: device.displayName, simulated: true, active: true },
      { cardUid: input.cardUid, event: "CARD_DETECTED", eventId: randomUUID() },
    );

    // Remember the identified student in the signed httpOnly cookie (same as a real terminal).
    if (result.identification.identified && result.identification.student) {
      await setStudentIdentification(result.identification.student.id);
    }

    return json({ ...result, simulated: true });
  });
}
