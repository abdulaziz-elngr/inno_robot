import { adminUserSchema, paginationSchema } from "@/lib/validation/admin";
import { assertSameOrigin, requireUser } from "@/server/auth/guard";
import { createUser, listUsers } from "@/server/services/admin-users";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/users */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser("users.manage");
    const query = paginationSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return json(await listUsers(query));
  });
}

/** POST /api/admin/users — create an admin account (roles assigned explicitly). */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("users.manage");
    const input = await readJson(req, adminUserSchema);
    const result = await createUser(input, user.id);
    return json(result, { status: 201 });
  });
}
