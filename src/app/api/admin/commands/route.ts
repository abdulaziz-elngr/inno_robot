import { z } from "zod";
import { createCommandSchema } from "@/lib/validation/commands";
import { assertSameOrigin, requireUser } from "@/server/auth/guard";
import { createCommand, getCommandStats, listCommands } from "@/server/services/commands";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  deviceId: z.string().trim().max(64).optional(),
  status: z.enum(["PENDING", "SENT", "ACKNOWLEDGED", "EXECUTING", "COMPLETED", "FAILED", "EXPIRED", "CANCELLED"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** GET /api/admin/commands — queue listing + live stats. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser("devices.read");
    const query = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    const [rows, stats] = await Promise.all([listCommands(query), getCommandStats()]);
    return json({ rows, stats });
  });
}

/** POST /api/admin/commands — issue a validated command (movement needs manual-mode ack). */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    // STOP uses the dedicated emergency endpoint; everything else needs commands.issue.
    const input = await readJson(req, createCommandSchema);
    const permission = input.type === "STOP" ? ("commands.stop" as const) : ("commands.issue" as const);
    const user = await requireUser(permission);
    const result = await createCommand(input, { userId: user.id, label: user.email });
    return json(result, { status: result.duplicate ? 200 : 201 });
  });
}
