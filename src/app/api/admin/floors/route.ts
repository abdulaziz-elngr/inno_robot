import { z } from "zod";
import { floorSchema } from "@/lib/validation/admin";
import { assertSameOrigin, requireUser } from "@/server/auth/guard";
import { createFloor, listFloors } from "@/server/services/locations";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

const querySchema = z.object({ buildingId: z.string().trim().max(64).optional() });

/** GET /api/admin/floors?buildingId=… */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser("locations.manage");
    const query = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return json({ rows: await listFloors(query.buildingId) });
  });
}

/** POST /api/admin/floors */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("locations.manage");
    const input = await readJson(req, floorSchema);
    return json(await createFloor(input, user.id), { status: 201 });
  });
}
