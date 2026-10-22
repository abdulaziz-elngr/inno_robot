import { roleUpsertSchema } from "@/lib/validation/admin";
import { assertSameOrigin, requireUser } from "@/server/auth/guard";
import { listPermissions, listRolesWithPermissions, upsertRole } from "@/server/services/admin-users";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/roles — roles with their permission keys + the full permission catalogue. */
export async function GET() {
  return handle(async () => {
    await requireUser("roles.manage");
    const [roles, permissions] = await Promise.all([listRolesWithPermissions(), listPermissions()]);
    return json({ rows: roles, permissions });
  });
}

/** PUT /api/admin/roles — upsert a role's permission set. */
export async function PUT(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("roles.manage");
    const input = await readJson(req, roleUpsertSchema);
    await upsertRole(input, user.id);
    return json({ ok: true });
  });
}
