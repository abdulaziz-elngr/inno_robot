import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { getServerI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return { title: t("public.terms.title") };
}

const SECTION_COUNT = 4;

/** Terms of use. Sections come from the dictionary so both languages stay aligned. */
export default async function TermsPage() {
  const { t, locale } = await getServerI18n();
  const updated = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { dateStyle: "long" }).format(new Date("2026-01-01"));

  return (
    <div className="container-page max-w-3xl py-10">
      <header className="mb-8">
        <h1 className="flex items-center gap-3 text-3xl font-bold text-fg">
          <FileText className="size-8 text-primary" aria-hidden />
          {t("public.terms.title")}
        </h1>
        <p className="mt-2 text-sm text-subtle">{t("public.terms.updated", { date: updated })}</p>
        <p className="mt-4 leading-relaxed text-muted">{t("public.terms.intro")}</p>
      </header>

      <div className="space-y-5">
        {Array.from({ length: SECTION_COUNT }, (_, i) => i + 1).map((index) => (
          <section key={index} className="surface p-5">
            <h2 className="font-semibold text-fg">{t(`public.terms.sections.${index - 1}.heading`)}</h2>
            <p className="mt-2 leading-relaxed text-muted">{t(`public.terms.sections.${index - 1}.body`)}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
