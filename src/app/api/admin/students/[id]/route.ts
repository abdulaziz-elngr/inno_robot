import { z } from "zod";
import { studentSchema } from "@/lib/validation/admin";
import { idSchema } from "@/lib/validation/common";
import { requireUser, assertSameOrigin, ApiError } from "@/server/auth/guard";
import { archiveStudent, getStudent, updateStudent } from "@/server/services/students";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: idSchema });

async function idFromReq(req: Request): Promise<string> {
  const { pathname } = new URL(req.url);
  const id = pathname.split("/").filter(Boolean).at(-1);
  if (!id) throw new ApiError(400, "Missing student id.", "MISSING_ID");
  return paramsSchema.parse({ id }).id;
}

/** GET /api/admin/students/[id] — full student detail including cards. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser("students.read");
    return json(await getStudent(await idFromReq(req)));
  });
}

/** PATCH /api/admin/students/[id] — update a student. */
export async function PATCH(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("students.write");
    const input = await readJson(req, studentSchema);
    await updateStudent(await idFromReq(req), input, user.id);
    return json({ ok: true });
  });
}

/** DELETE /api/admin/students/[id] — archive (soft-delete; cards stop identifying). */
export async function DELETE(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("students.write");
    await archiveStudent(await idFromReq(req), user.id);
    return json({ ok: true });
  });
}
