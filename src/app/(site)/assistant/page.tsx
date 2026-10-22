import type { Metadata } from "next";
import { AssistantExperience } from "@/components/assistant/assistant-experience";
import { getServerI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return { title: t("assistant.title") };
}

/** Production assistant terminal experience (identification happens via real NFC hardware). */
export default async function AssistantPage() {
  const { t } = await getServerI18n();
  return (
    <div className="container-page py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg">{t("assistant.title")}</h1>
        <p className="mt-1 text-muted">{t("assistant.subtitle")}</p>
      </header>
      <AssistantExperience />
    </div>
  );
}
