import type { Metadata } from "next";
import Link from "next/link";
import { Activity, BookOpen, Bot, CreditCard, GraduationCap, MapPin, TerminalSquare, Users } from "lucide-react";
import { PageHeader, Panel, PanelBody, PanelHeader, StatCard, StatGrid } from "@/components/admin/primitives";
import { Badge } from "@/components/ui/badge";
import { getServerI18n } from "@/lib/i18n/server";
import { requireUserPage } from "@/server/auth/guard";
import { getOverviewMetrics, getRangeSeries } from "@/server/services/analytics";
import { listDeviceEvents } from "@/server/services/devices";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Overview" };

/** Admin overview — every number below is a live database aggregate. */
export default async function AdminOverviewPage() {
  const { t } = await getServerI18n();
  await requireUserPage("analytics.read", "/admin");

  const [metrics, series, events] = await Promise.all([
    getOverviewMetrics(),
    getRangeSeries(7),
    listDeviceEvents("INNO-01", 8).catch(() => []),
  ]);

  const totalMessages = series.messages.reduce((sum, day) => sum + day.user + day.assistant, 0);
  const hasData = metrics.students.total + metrics.cards.total + metrics.devices.total + metrics.knowledge.total + metrics.conversations.total > 0;

  return (
    <div>
      <PageHeader
        title={t("admin.overview.title")}
        description={t("admin.overview.subtitle")}
        actions={
          <Link href="/admin/students" className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-semibold text-white hover:bg-primary-deep">
            {t("admin.overview.emptyAction")}
          </Link>
        }
      />

      {!hasData && (
        <Panel className="mb-6">
          <PanelBody>
            <p className="font-medium text-fg">{t("admin.overview.emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted">{t("admin.overview.emptyBody")}</p>
          </PanelBody>
        </Panel>
      )}

      <StatGrid className="mb-6">
        <StatCard label={t("admin.overview.students")} value={metrics.students.total} hint={`${metrics.students.active} ${t("common.active")}`} icon={<GraduationCap className="size-5" aria-hidden />} />
        <StatCard label={t("admin.overview.activeCards")} value={metrics.cards.active} hint={`${metrics.cards.revoked} ${t("admin.students.cards.statusRevoked")}`} icon={<CreditCard className="size-5" aria-hidden />} />
        <StatCard
          label={t("admin.overview.devices")}
          value={metrics.devices.total}
          hint={`${metrics.devices.online} ${t("admin.overview.onlineDevices")}${metrics.devices.simulated ? ` · ${t("admin.overview.simulatedBadge")}` : ""}`}
          icon={<Bot className="size-5" aria-hidden />}
          tone={metrics.devices.online > 0 ? "success" : "default"}
        />
        <StatCard label={t("admin.overview.publishedLocations")} value={metrics.locations.published} hint={`${metrics.locations.navigable} navigable`} icon={<MapPin className="size-5" aria-hidden />} />
        <StatCard label={t("admin.overview.knowledgeEntries")} value={metrics.knowledge.published} hint={`${metrics.knowledge.total} total`} icon={<BookOpen className="size-5" aria-hidden />} />
        <StatCard label={t("admin.overview.conversations")} value={metrics.conversations.last30Days} hint={`${totalMessages} ${t("admin.overview.messageVolume")}`} icon={<Users className="size-5" aria-hidden />} />
        <StatCard
          label={t("admin.overview.commandSuccess")}
          value={`${metrics.commands.successRate}%`}
          hint={`${metrics.commands.completed} ${t("admin.overview.commandCompleted")} · ${metrics.commands.failed} ${t("admin.overview.commandFailed")}`}
          icon={<TerminalSquare className="size-5" aria-hidden />}
          tone={metrics.commands.failed > 0 && metrics.commands.failed > metrics.commands.completed ? "error" : "success"}
        />
        <StatCard label={t("admin.overview.recentEvents")} value={metrics.events.last24h} hint={`${metrics.events.total} total`} icon={<Activity className="size-5" aria-hidden />} />
      </StatGrid>

      {/* Message volume over the last 7 days */}
      <Panel className="mb-6">
        <PanelHeader title={t("admin.overview.messageVolume")} description={`${series.days} days`} />
        <PanelBody>
          {totalMessages === 0 ? (
            <p className="text-sm text-subtle">{t("admin.overview.emptyTitle")}</p>
          ) : (
            <div className="flex h-32 items-end gap-1.5" role="img" aria-label={`${totalMessages} messages in ${series.days} days`}>
              {series.messages.map((day) => {
                const total = day.user + day.assistant;
                const max = Math.max(...series.messages.map((d) => d.user + d.assistant), 1);
                return (
                  <div key={day.day} className="group relative flex-1">
                    <div className="w-full rounded-t bg-primary/85 transition-colors group-hover:bg-primary" style={{ height: `${Math.max(4, (total / max) * 120)}px` }} title={`${day.day}: ${total}`} />
                  </div>
                );
              })}
            </div>
          )}
        </PanelBody>
      </Panel>

      {/* Recent device events (first device — the console lists per-robot detail on the robot page) */}
      <Panel>
        <PanelHeader title={t("admin.overview.recentEvents")} actions={<Badge variant="outline">{events.length}</Badge>} />
        <PanelBody>
          {events.length === 0 ? (
            <p className="text-sm text-subtle">{t("admin.common.noData")}</p>
          ) : (
            <ul className="space-y-2">
              {events.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-mono text-xs text-muted">{event.type}</span>
                  <span className="text-xs text-subtle">{new Date(event.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
