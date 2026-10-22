import type { Metadata } from "next";
import { AnalyticsManager } from "@/components/admin/analytics-manager";
import { requireUserPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analytics" };

/** Live aggregates — every number comes from the database, never from third-party tracking. */
export default async function AnalyticsPage() {
  await requireUserPage("analytics.read", "/admin/analytics");
  return <AnalyticsManager />;
}
