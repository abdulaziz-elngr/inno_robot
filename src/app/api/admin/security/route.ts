import { requireUser } from "@/server/auth/guard";
import { getSecurityOverview } from "@/server/services/analytics";
import { handle, json } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/security — recent auth events, active sessions, device events. */
export async function GET() {
  return handle(async () => {
    await requireUser("security.read");
    return json(await getSecurityOverview());
  });
}
