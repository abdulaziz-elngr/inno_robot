import { z } from "zod";
import { assertSameOrigin, requireUser, ApiError } from "@/server/auth/guard";
import { cancelCommand, getCommand } from "@/server/services/commands";
import { handle, json } from "@/server/http";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().trim().min(1).max(64) });

async function idFromReq(req: Request): Promise<string> {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).at(-1);
  if (!id) throw new ApiError(400, "Missing command id.", "MISSING_ID");
  return paramsSchema.parse({ id }).id;
}

/** GET /api/admin/commands/[id] */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser("devices.read");
    return json(await getCommand(await idFromReq(req)));
  });
}

/** POST /api/admin/commands/[id]/cancel — cancel a queued command. */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("commands.issue");
    const command = await cancelCommand(await idFromReq(req), { userId: user.id, label: user.email });
    return json({ ok: true, command });
  });
}
