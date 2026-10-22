import { getAIStatus } from "@/server/services/ai";
import { handle, json } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/assistant/status — tells the UI whether a real AI provider is configured. */
export async function GET() {
  return handle(async () => {
    const status = await getAIStatus();
    return json(status);
  });
}
