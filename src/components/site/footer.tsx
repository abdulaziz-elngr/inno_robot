"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { useI18n } from "@/lib/i18n/provider";

export function SiteFooter() {
  const { t, dict } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-card/60">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted">{dict.public.landing.subtitle}</p>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">{t("public.footer.product")}</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/assistant" className="text-muted hover:text-primary">{t("public.nav.assistant")}</Link></li>
            <li><Link href="/campus" className="text-muted hover:text-primary">{t("public.nav.campus")}</Link></li>
            <li><Link href="/control" className="text-muted hover:text-primary">{t("public.nav.control")}</Link></li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">{t("public.footer.information")}</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/help" className="text-muted hover:text-primary">{t("public.footer.help")}</Link></li>
            <li><Link href="/login" className="text-muted hover:text-primary">{t("public.nav.login")}</Link></li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">{t("public.footer.legal")}</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/privacy" className="text-muted hover:text-primary">{t("public.footer.privacy")}</Link></li>
            <li><Link href="/terms" className="text-muted hover:text-primary">{t("public.footer.terms")}</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/70">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>{t("public.footer.copyright", { year })}</p>
          <p className="max-w-xl">{t("public.footer.disclaimer")}</p>
        </div>
      </div>
    </footer>
  );
}
