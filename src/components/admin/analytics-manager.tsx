"use client";

import { useState } from "react";
import { PageHeader, Panel, PanelBody, StatGrid, StatCard } from "@/components/admin/primitives";
import { BarChart } from "@/components/admin/charts";
import { adminFetch, useAsyncData } from "@/components/admin/client";
import { Select } from "@/components/ui/field";
import { useI18n } from "@/lib/i18n/provider";

type Overview = {
  students: { total: number; active: number };
  cards: { total: number; active: number; revoked: number };
  devices: { total: number; online: number; simulated: number };
  locations: { published: number; navigable: number; total: number };
  knowledge: { published: number; total: number };
  conversations: { total: number; last30Days: number };
  commands: { total: number; completed: number; failed: number; pending: number; successRate: number };
  events: { total: number; last24h: number };
};
type Series = {
  days: number;
  messages: Array<{ day: string; user: number; assistant: number }>;
  commands: Array<{ day: string; completed: number; failed: number; total: number }>;
  conversations: Array<{ day: string; count: number }>;
};

export function AnalyticsManager() {
  const { t } = useI18n();
  const [days, setDays] = useState("14");

  const { data, loading, error } = useAsyncData(
    () => adminFetch<{ overview: Overview; series: Series }>(`/api/admin/analytics?days=${days}`),
    [days],
  );

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  const { overview, series } = data;
  const totalMessages = series.messages.reduce((sum, day) => sum + day.user + day.assistant, 0);
  const totalConversations = series.conversations.reduce((sum, day) => sum + day.count, 0);
  const totalCommands = series.commands.reduce((sum, day) => sum + day.total, 0);
  const hasData = totalMessages + totalConversations + totalCommands > 0;

  return (
    <div>
      <PageHeader
        title={t("admin.system.analytics.title")}
        description={t("admin.system.analytics.description")}
        actions={
          <Select value={days} onChange={(e) => setDays(e.target.value)} aria-label={t("admin.system.analytics.range")} className="w-36">
            <option value="7">{t("admin.system.analytics.range7")}</option>
            <option value="14">{t("admin.system.analytics.range14")}</option>
            <option value="30">{t("admin.system.analytics.range30")}</option>
          </Select>
        }
      />

      {error && (
        <Panel className="mb-6">
          <PanelBody>
            <p className="text-sm text-error">{error}</p>
          </PanelBody>
        </Panel>
      )}

      <StatGrid className="mb-6">
        <StatCard label={t("admin.system.analytics.students")} value={overview.students.total} hint={`${overview.students.active} ${t("common.active")}`} />
        <StatCard label={t("admin.system.analytics.cards")} value={overview.cards.active} hint={`${overview.cards.revoked} ${t("admin.students.cards.statusRevoked")}`} />
        <StatCard label={t("admin.system.analytics.devices")} value={overview.devices.total} hint={`${overview.devices.online} ${t("admin.robots.devices.online")}`} />
        <StatCard label={t("admin.system.analytics.successRate")} value={`${overview.commands.successRate}%`} hint={`${overview.commands.completed} / ${overview.commands.total}`} />
      </StatGrid>

      {!hasData && (
        <Panel className="mb-6">
          <PanelBody>
            <p className="font-medium text-fg">{t("admin.system.analytics.empty")}</p>
            <p className="mt-1 text-sm text-muted">{t("admin.system.analytics.emptyHint")}</p>
          </PanelBody>
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel>
          <PanelBody>
            <BarChart
              label={t("admin.system.analytics.messages")}
              ariaLabel={`${totalMessages} ${t("admin.system.analytics.messages")} (${t("admin.system.analytics.messageSplit")}: ${series.messages.reduce((s, d) => s + d.user, 0)} / ${series.messages.reduce((s, d) => s + d.assistant, 0)})`}
              data={series.messages.map((day) => ({ key: day.day.slice(5), value: day.user + day.assistant, title: `${day.day}: ${day.user} / ${day.assistant}` }))}
            />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <BarChart
              label={t("admin.system.analytics.conversations")}
              ariaLabel={`${totalConversations} ${t("admin.system.analytics.conversations")}`}
              color="var(--color-violet, #A78BFA)"
              data={series.conversations.map((day) => ({ key: day.day.slice(5), value: day.count }))}
            />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <BarChart
              label={t("admin.system.analytics.commandsChart")}
              ariaLabel={`${totalCommands} ${t("admin.system.analytics.commandsChart")}`}
              color="var(--color-success, #16A34A)"
              data={series.commands.map((day) => ({ key: day.day.slice(5), value: day.total, title: `${day.day}: ${day.completed} âœ“ / ${day.failed} âœ—` }))}
            />
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
