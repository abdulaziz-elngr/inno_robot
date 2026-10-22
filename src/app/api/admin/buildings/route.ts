import { buildingSchema } from "@/lib/validation/admin";
import { assertSameOrigin, requireUser } from "@/server/auth/guard";
import { createBuilding, listBuildings } from "@/server/services/locations";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/buildings */
export async function GET() {
  return handle(async () => {
    await requireUser("locations.manage");
    return json({ rows: await listBuildings() });
  });
}

/** POST /api/admin/buildings */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("locations.manage");
    const input = await readJson(req, buildingSchema);
    return json(await createBuilding(input, user.id), { status: 201 });
  });
}
