import type { Metadata } from "next";
import { ControlPanel } from "@/components/control/control-panel";
import { getServerI18n } from "@/lib/i18n/server";
import { requireUserPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return { title: t("control.title") };
}

/**
 * Mobile remote-control console. Requires an authenticated operator session
 * (server-side gate) — every action inside the panel is permission-checked again
 * by the API regardless of what the UI shows.
 */
export default async function ControlPage() {
  const { t } = await getServerI18n();
  await requireUserPage("commands.issue", "/control");

  return (
    <div className="container-page py-8">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-fg">{t("control.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("control.subtitle")}</p>
      </header>
      <ControlPanel />
    </div>
  );
}
