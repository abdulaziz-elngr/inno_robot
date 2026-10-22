import { navigationRouteSchema } from "@/lib/validation/admin";
import { assertSameOrigin, requireUser } from "@/server/auth/guard";
import { listNavigationRoutes, upsertNavigationRoute } from "@/server/services/locations";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/navigation/routes */
export async function GET() {
  return handle(async () => {
    await requireUser("navigation.manage");
    return json({ rows: await listNavigationRoutes() });
  });
}

/** POST /api/admin/navigation/routes — upsert the route for a destination. */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("navigation.manage");
    const input = await readJson(req, navigationRouteSchema);
    const id = await upsertNavigationRoute(input, user.id);
    return json({ ok: true, id });
  });
}
