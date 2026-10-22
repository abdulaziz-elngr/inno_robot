import type { Metadata } from "next";
import { PageHeader, Panel, PanelBody, StatGrid, StatCard } from "@/components/admin/primitives";
import { Badge } from "@/components/ui/badge";
import { getServerI18n } from "@/lib/i18n/server";
import { requireUserPage } from "@/server/auth/guard";
import { getSecurityOverview } from "@/server/services/analytics";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Security" };

/** Security overview: audit trail and live counters. Read-only by design. */
export default async function SecurityPage() {
  const { t } = await getServerI18n();
  await requireUserPage("security.read", "/admin/security");
  const overview = await getSecurityOverview(50);

  return (
    <div>
      <PageHeader title={t("admin.system.security.title")} description={t("admin.system.security.description")} />

      <StatGrid className="mb-6">
        <StatCard label={t("admin.system.security.sessions")} value={overview.activeSessions} />
        <StatCard
          label={t("admin.system.security.authEvents")}
          value={overview.loginFailures24h}
          hint="24h"
          tone={overview.loginFailures24h > 5 ? "error" : "default"}
        />
        <StatCard label={t("admin.students.cards.statusRevoked")} value={overview.revokedCards} />
        <StatCard label={t("admin.system.security.deviceEvents")} value={overview.events24h} hint="24h" />
      </StatGrid>

      <Panel>
        <div className="border-b border-border/70 px-5 py-4">
          <h2 className="text-sm font-semibold text-fg">{t("admin.system.security.authEvents")}</h2>
          <p className="mt-0.5 text-xs text-muted">{t("admin.system.security.note")}</p>
        </div>
        {overview.recentAudit.length === 0 ? (
          <PanelBody>
            <p className="text-sm text-muted">{t("admin.system.security.emptyEvents")}</p>
          </PanelBody>
        ) : (
          <ul className="divide-y divide-border/70">
            {overview.recentAudit.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <Badge variant={row.action.includes("failed") ? "error" : row.action.includes("created") ? "success" : "outline"}>{row.action}</Badge>
                <span className="text-fg">{row.actorLabel}</span>
                <span className="font-mono text-xs text-muted">
                  {row.targetType ?? "—"}
                  {row.targetId ? ` · ${row.targetId.slice(0, 8)}` : ""}
                </span>
                <span className="font-mono text-xs text-subtle">{row.ip ?? "—"}</span>
                <span className="ms-auto text-xs text-muted">{new Date(row.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
