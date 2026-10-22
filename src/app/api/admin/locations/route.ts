import { locationQuerySchema, locationSchema } from "@/lib/validation/admin";
import { assertSameOrigin, requireUser } from "@/server/auth/guard";
import { createLocation, listLocations } from "@/server/services/locations";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/locations — paginated, admin-visible (includes unpublished). */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser("locations.manage");
    const query = locationQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return json(await listLocations(query));
  });
}

/** POST /api/admin/locations */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("locations.manage");
    const input = await readJson(req, locationSchema);
    return json(await createLocation(input, user.id), { status: 201 });
  });
}
