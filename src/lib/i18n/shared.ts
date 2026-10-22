export type Locale = "ar" | "en";
export const LOCALES: Locale[] = ["ar", "en"];
export const LOCALE_COOKIE = "inno_locale";
export const THEME_COOKIE = "inno_theme";

export function isLocale(value: unknown): value is Locale {
  return value === "ar" || value === "en";
}

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** BCP-47 tag for `lang` attributes and speech synthesis. */
export function bcp47(locale: Locale): string {
  return locale === "ar" ? "ar-EG" : "en-US";
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
