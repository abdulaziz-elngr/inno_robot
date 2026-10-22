import { studentSchema, studentQuerySchema } from "@/lib/validation/admin";
import { requireUser, assertSameOrigin } from "@/server/auth/guard";
import { createStudent, listStudents } from "@/server/services/students";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/students — paginated student directory (RBAC: students.read). */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser("students.read");
    const query = studentQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return json(await listStudents(query));
  });
}

/** POST /api/admin/students — create a student record. */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("students.write");
    const input = await readJson(req, studentSchema);
    const result = await createStudent(input, user.id);
    return json(result, { status: 201 });
  });
}
