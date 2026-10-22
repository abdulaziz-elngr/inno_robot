import type { Locale } from "@/lib/i18n/shared";

const INTL_LOCALE: Record<Locale, string> = { ar: "ar-EG-u-nu-latn", en: "en-GB" };

export function formatDate(value: Date | string | number | null | undefined, locale: Locale = "en"): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "medium" }).format(date);
}

export function formatDateTime(value: Date | string | number | null | undefined, locale: Locale = "en"): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatTime(value: Date | string | number | null | undefined, locale: Locale = "en"): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeStyle: "short" }).format(date);
}

/** "just now / 5m ago / 3h ago / 2d ago" using the active locale. */
export function formatRelative(value: Date | string | number | null | undefined, locale: Locale = "en"): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return locale === "ar" ? "الآن" : "Just now";
  if (minutes < 60) return locale === "ar" ? `منذ ${minutes} د` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return locale === "ar" ? `منذ ${hours} س` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return locale === "ar" ? `منذ ${days} يوم` : `${days}d ago`;
  return formatDate(date, locale);
}

export function formatNumber(value: number, locale: Locale = "en"): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

export function formatPercent(value: number, locale: Locale = "en"): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { style: "percent", maximumFractionDigits: 0 }).format(value / 100);
}
