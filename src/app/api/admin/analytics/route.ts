import { z } from "zod";
import { requireUser } from "@/server/auth/guard";
import { getOverviewMetrics, getRangeSeries } from "@/server/services/analytics";
import { handle, json } from "@/server/http";

export const dynamic = "force-dynamic";

const querySchema = z.object({ days: z.coerce.number().int().min(1).max(90).default(14) });

/** GET /api/admin/analytics — overview metrics + time series. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser("analytics.read");
    const query = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    const [overview, series] = await Promise.all([getOverviewMetrics(), getRangeSeries(query.days)]);
    return json({ overview, series });
  });
}
