import { settingsSchema } from "@/lib/validation/admin";
import { assertSameOrigin, requireUser } from "@/server/auth/guard";
import { getSettings, updateSettings } from "@/server/services/settings";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/settings */
export async function GET() {
  return handle(async () => {
    await requireUser("settings.manage");
    return json(await getSettings());
  });
}

/** PUT /api/admin/settings */
export async function PUT(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("settings.manage");
    const input = await readJson(req, settingsSchema);
    await updateSettings(input, user.id);
    return json({ ok: true });
  });
}
