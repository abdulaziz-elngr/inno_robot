import { z } from "zod";
import { departmentSchema } from "@/lib/validation/admin";
import { assertSameOrigin, requireUser } from "@/server/auth/guard";
import { createDepartment, listDepartments } from "@/server/services/academics";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

const querySchema = z.object({ facultyId: z.string().trim().max(64).optional() });

/** GET /api/admin/departments?facultyId=… */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser("academics.manage");
    const query = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return json({ rows: await listDepartments(query.facultyId) });
  });
}

/** POST /api/admin/departments */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("academics.manage");
    const input = await readJson(req, departmentSchema);
    return json(await createDepartment(input, user.id), { status: 201 });
  });
}
