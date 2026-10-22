import { knowledgeCategorySchema } from "@/lib/validation/admin";
import { assertSameOrigin, requireUser } from "@/server/auth/guard";
import { createKnowledgeCategory, listKnowledgeCategories } from "@/server/services/knowledge";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/knowledge/categories */
export async function GET() {
  return handle(async () => {
    await requireUser("knowledge.manage");
    return json({ rows: await listKnowledgeCategories() });
  });
}

/** POST /api/admin/knowledge/categories */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    await requireUser("knowledge.manage");
    const input = await readJson(req, knowledgeCategorySchema);
    return json(await createKnowledgeCategory(input), { status: 201 });
  });
}
