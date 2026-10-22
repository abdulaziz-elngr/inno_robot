import { facultySchema } from "@/lib/validation/admin";
import { assertSameOrigin, requireUser } from "@/server/auth/guard";
import { createFaculty, listFaculties } from "@/server/services/academics";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/faculties */
export async function GET() {
  return handle(async () => {
    await requireUser("academics.manage");
    return json({ rows: await listFaculties() });
  });
}

/** POST /api/admin/faculties */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("academics.manage");
    const input = await readJson(req, facultySchema);
    return json(await createFaculty(input, user.id), { status: 201 });
  });
}
