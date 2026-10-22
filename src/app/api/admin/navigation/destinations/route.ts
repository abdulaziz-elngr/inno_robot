import { navigationDestinationSchema } from "@/lib/validation/admin";
import { assertSameOrigin, requireUser } from "@/server/auth/guard";
import { listNavigationDestinations, upsertNavigationDestination } from "@/server/services/locations";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/navigation/destinations */
export async function GET() {
  return handle(async () => {
    await requireUser("navigation.manage");
    return json({ rows: await listNavigationDestinations() });
  });
}

/** POST /api/admin/navigation/destinations — upsert by key. */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("navigation.manage");
    const input = await readJson(req, navigationDestinationSchema);
    const id = await upsertNavigationDestination(input, user.id);
    return json({ ok: true, id });
  });
}
