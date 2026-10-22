import type { Metadata } from "next";
import { AssistantExperience } from "@/components/assistant/assistant-experience";
import { Badge } from "@/components/ui/badge";
import { getServerI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return { title: `${t("assistant.title")} — Demo` };
}

/**
 * Demo assistant: identical to production except identification is simulated in the
 * browser (gated server-side by ENABLE_SIMULATION). Every simulated event is flagged.
 */
export default async function AssistantDemoPage() {
  const { t } = await getServerI18n();
  return (
    <div className="container-page py-8">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t("assistant.title")}</h1>
          <p className="mt-1 text-muted">{t("assistant.subtitle")}</p>
        </div>
        <Badge variant="simulated">{t("assistant.demoNotice")}</Badge>
      </header>
      <AssistantExperience demo />
    </div>
  );
}
