import { conversationQuerySchema } from "@/lib/validation/admin";
import { requireUser } from "@/server/auth/guard";
import { listConversations } from "@/server/services/conversations";
import { handle, json } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/conversations — recent conversations (contents on the detail route). */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser("conversations.read");
    const query = conversationQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return json(await listConversations(query));
  });
}
