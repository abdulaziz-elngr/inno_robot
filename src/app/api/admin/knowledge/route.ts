import { knowledgeArticleSchema, knowledgeQuerySchema } from "@/lib/validation/admin";
import { assertSameOrigin, requireUser } from "@/server/auth/guard";
import { createKnowledgeArticle, listKnowledge } from "@/server/services/knowledge";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/knowledge — paginated article list. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser("knowledge.manage");
    const query = knowledgeQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return json(await listKnowledge(query));
  });
}

/** POST /api/admin/knowledge — create a draft article. */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("knowledge.manage");
    const input = await readJson(req, knowledgeArticleSchema);
    return json(await createKnowledgeArticle(input, user.id), { status: 201 });
  });
}
