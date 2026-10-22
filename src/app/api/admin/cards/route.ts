import { associateCardSchema, revokeCardSchema } from "@/lib/validation/nfc";
import { assertSameOrigin, requireUser } from "@/server/auth/guard";
import { associateCard, listCards, revokeCard } from "@/server/services/students";
import { handle, json, readJson } from "@/server/http";
import { paginationSchema } from "@/lib/validation/admin";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = paginationSchema.extend({
  status: z.enum(["ACTIVE", "REVOKED", "LOST"]).optional(),
});

/** GET /api/admin/cards — card registry (last-4 only, never full UIDs). */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser("cards.manage");
    const query = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return json(await listCards(query));
  });
}

/** POST /api/admin/cards — associate a card UID to a student (or revoke one). */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("cards.manage");
    const body = await readJson(req, z.union([z.object({ action: z.literal("associate") }).merge(associateCardSchema), z.object({ action: z.literal("revoke") }).merge(revokeCardSchema)]));
    if (body.action === "associate") {
      const card = await associateCard(body, user.id);
      return json({ ok: true, card: { id: card.id, uidLast4: card.uidLast4, status: card.status } }, { status: 201 });
    }
    await revokeCard(body, user.id);
    return json({ ok: true });
  });
}
