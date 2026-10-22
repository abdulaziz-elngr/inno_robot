"use client";

import { useI18n } from "@/lib/i18n/provider";
import { LOCALES, type Locale } from "@/lib/i18n/shared";
import { cn } from "@/lib/cn";

/** Arabic ⇄ English switcher. Persists to a cookie so the server renders the right direction. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  return (
    <div className={cn("inline-flex items-center rounded-lg border border-border bg-card p-0.5", className)} role="group" aria-label="Language">
      {LOCALES.map((code: Locale) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
            locale === code ? "bg-primary text-white" : "text-muted hover:text-fg",
          )}
        >
          {code === "ar" ? "العربية" : "EN"}
        </button>
      ))}
    </div>
  );
}
