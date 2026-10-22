import { cookies } from "next/headers";
import en, { translate, type Dictionary } from "./en";
import ar from "./ar";
import { deepMerge } from "./merge";
import { LOCALE_COOKIE, dirFor, isLocale, type Locale } from "./shared";

const arDictionary = deepMerge(en, ar);

/** Active locale from the preference cookie (default Arabic). */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "ar";
}

export type ServerI18n = {
  locale: Locale;
  dir: "rtl" | "ltr";
  dict: Dictionary;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

/** Server-side translation helper for layouts and server components. */
export async function getServerI18n(): Promise<ServerI18n> {
  const locale = await getLocale();
  const dict = locale === "ar" ? arDictionary : en;
  return { locale, dir: dirFor(locale), dict, t: (key, vars) => translate(dict, key, vars) };
}
