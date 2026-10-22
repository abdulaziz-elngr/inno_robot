"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "./button";
import { useI18n } from "@/lib/i18n/provider";

/** URL-driven pagination (?page=2) so admin lists stay linkable and server-rendered. */
export function Pagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const goTo = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(next));
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3" dir={locale === "ar" ? "rtl" : "ltr"}>
      <p className="text-xs text-muted" aria-live="polite">
        {t("common.showing", { from, to, total })}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goTo(page - 1)} aria-label={t("common.previous")}>
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t("common.previous")}
        </Button>
        <span className="text-xs text-muted">
          {t("common.page", { page, total: totalPages })}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goTo(page + 1)} aria-label={t("common.next")}>
          {t("common.next")}
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
