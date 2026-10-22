import { z } from "zod";
import { commandAckSchema } from "@/lib/validation/commands";
import { verifyDeviceRequest } from "@/server/auth/device-auth";
import { acknowledgeCommand } from "@/server/services/commands";
import { handle, json, readJson, readRawBody } from "@/server/http";

export const dynamic = "force-dynamic";

const ackRequestSchema = z.object({
  commandId: z.string().min(1).max(64),
  ...commandAckSchema.shape,
});

/** Device acknowledges a command's lifecycle (ACK → EXECUTING → COMPLETED/FAILED). */
export async function POST(req: Request) {
  return handle(async () => {
    const raw = await readRawBody(req);
    const body = await readJson(req, ackRequestSchema);
    const device = await verifyDeviceRequest(req, raw);
    const { commandId, ...ack } = body;
    const command = await acknowledgeCommand(device.deviceId, commandId, ack);
    return json({ ok: true, command: { id: command.id, status: command.status } });
  });
}
