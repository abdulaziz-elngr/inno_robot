import { assertSameOrigin } from "@/server/auth/guard";
import { setStudentIdentification } from "@/server/auth/identification";
import { assertSimulationAllowed, handle, json } from "@/server/http";

export const dynamic = "force-dynamic";

/** POST /api/assistant/demo/reset — forgets the identified student (demo only). */
export async function POST(req: Request) {
  return handle(async () => {
    assertSimulationAllowed();
    assertSameOrigin(req);
    await setStudentIdentification(null);
    return json({ ok: true });
  });
}
