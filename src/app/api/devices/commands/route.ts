import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import { robotCommands } from "@/server/db/schema";
import { verifyDeviceRequest } from "@/server/auth/device-auth";
import { expireStaleCommands } from "@/server/services/commands";
import { handle, json, readRawBody } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * Device command poll. Returns this device's actionable commands (PENDING/SENT),
 * emergency first, then oldest-first. Opportunistically expires stale commands.
 * Status is not mutated here — the device acknowledges via /commands/ack.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const raw = await readRawBody(req);
    const device = await verifyDeviceRequest(req, raw);
    await expireStaleCommands(device.deviceId);

    const commands = await db
      .select({
        id: robotCommands.id,
        type: robotCommands.type,
        payload: robotCommands.payload,
        priority: robotCommands.priority,
        status: robotCommands.status,
        createdAt: robotCommands.createdAt,
        expiresAt: robotCommands.expiresAt,
      })
      .from(robotCommands)
      .where(
        and(
          eq(robotCommands.deviceId, device.deviceId),
          inArray(robotCommands.status, ["PENDING", "SENT"]),
        ),
      )
      .orderBy(desc(robotCommands.priority), asc(robotCommands.createdAt))
      .limit(20);

    return json({ commands });
  });
}
