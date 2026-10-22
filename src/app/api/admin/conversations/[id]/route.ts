import { z } from "zod";
import { requireUser, ApiError } from "@/server/auth/guard";
import { getConversationDetail } from "@/server/services/conversations";
import { handle, json } from "@/server/http";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().trim().min(1).max(64) });

async function idFromReq(req: Request): Promise<string> {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).at(-1);
  if (!id) throw new ApiError(400, "Missing conversation id.", "MISSING_ID");
  return paramsSchema.parse({ id }).id;
}

/** GET /api/admin/conversations/[id] — full transcript for review. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser("conversations.read");
    return json(await getConversationDetail(await idFromReq(req)));
  });
}
