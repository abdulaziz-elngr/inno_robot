import type { Metadata } from "next";
import { LifeBuoy, MessageCircleQuestion } from "lucide-react";
import { getServerI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return { title: t("public.help.title") };
}

const QUESTIONS = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;

/** Help & FAQ — content lives in the i18n dictionary so both languages stay in sync. */
export default async function HelpPage() {
  const { t } = await getServerI18n();

  return (
    <div className="container-page max-w-3xl py-10">
      <header className="mb-8">
        <h1 className="flex items-center gap-3 text-3xl font-bold text-fg">
          <MessageCircleQuestion className="size-8 text-primary" aria-hidden />
          {t("public.help.title")}
        </h1>
        <p className="mt-2 text-muted">{t("public.help.subtitle")}</p>
      </header>

      <dl className="space-y-4">
        {QUESTIONS.map((key) => (
          <div key={key} className="surface p-5">
            <dt className="font-semibold text-fg">{t(`public.help.${key}`)}</dt>
            <dd className="mt-2 leading-relaxed text-muted">{t(`public.help.a${key.slice(1)}`)}</dd>
          </div>
        ))}
      </dl>

      <section className="surface mt-8 flex items-start gap-4 p-5">
        <LifeBuoy className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
        <div>
          <h2 className="font-semibold text-fg">{t("public.help.contactTitle")}</h2>
          <p className="mt-1 text-muted">{t("public.help.contactBody")}</p>
        </div>
      </section>
    </div>
  );
}
