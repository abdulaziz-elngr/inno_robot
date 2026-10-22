import { sql } from "drizzle-orm";
import { db, isEmbedded } from "@/server/db/client";
import { getAIConfig } from "@/server/services/ai";
import { handle, json } from "@/server/http";

/**
 * Health/readiness probe used by deployment smoke tests.
 * Never exposes secrets — only booleans and version-ish metadata.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    let database: "ok" | "error" = "error";
    try {
      await db.execute(sql`select 1`);
      database = "ok";
    } catch (error) {
      console.error("[health] database check failed:", error instanceof Error ? error.message : error);
    }
    const ai = getAIConfig();
    return json({
      status: database === "ok" ? "ok" : "degraded",
      database,
      databaseKind: isEmbedded() ? "embedded-postgres" : "postgres",
      aiConfigured: ai.configured,
      simulationAllowed: process.env.ENABLE_SIMULATION === "true" || process.env.NODE_ENV !== "production",
      time: new Date().toISOString(),
    });
  });
}
