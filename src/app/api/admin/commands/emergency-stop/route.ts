import { createCommandSchema } from "@/lib/validation/commands";
import { assertSameOrigin, requireUser } from "@/server/auth/guard";
import { createCommand } from "@/server/services/commands";
import { handle, json, readJson } from "@/server/http";
import { z } from "zod";

export const dynamic = "force-dynamic";

const emergencySchema = z.object({
  deviceId: createCommandSchema.shape.deviceId,
  reason: z.string().trim().max(200).default("Emergency stop"),
});

/**
 * POST /api/admin/commands/emergency-stop — the STOP path.
 * Always available (even to operators without general command rights), always audited,
 * bypasses manual-mode gating, cancels queued movement for the device.
 */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("commands.stop");
    const input = await readJson(req, emergencySchema);
    const result = await createCommand(
      { deviceId: input.deviceId, type: "STOP", payload: { reason: input.reason }, manualModeAcknowledged: true, confirmNavigation: true, ttlSeconds: 60 },
      { userId: user.id, label: user.email },
    );
    return json({ ok: true, ...result });
  });
}
