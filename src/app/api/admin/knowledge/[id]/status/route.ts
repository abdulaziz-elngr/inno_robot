import { z } from "zod";
import { assertSameOrigin, requireUser, ApiError } from "@/server/auth/guard";
import { setKnowledgeStatus } from "@/server/services/knowledge";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) });

async function idFromReq(req: Request): Promise<string> {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).at(-2);
  if (!id) throw new ApiError(400, "Missing article id.", "MISSING_ID");
  return id;
}

/** POST /api/admin/knowledge/[id]/status — publish / archive workflow. */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("knowledge.manage");
    const { status } = await readJson(req, bodySchema);
    await setKnowledgeStatus(await idFromReq(req), status, user.id);
    return json({ ok: true, status });
  });
}
