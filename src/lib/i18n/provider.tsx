"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en, { translate, type Dictionary } from "./en";
import ar from "./ar";
import { deepMerge } from "./merge";
import { LOCALE_COOKIE, dirFor, isLocale, type Locale } from "./shared";

type I18nValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  /** Fully merged dictionary for the active locale (English fallback applied). */
  dict: Dictionary;
  setLocale: (locale: Locale) => void;
  /** Dot-path translation with `{variable}` interpolation. */
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

const arDictionary = deepMerge(en, ar);
const dictionaryFor = (locale: Locale): Dictionary => (locale === "ar" ? arDictionary : en);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return;
    setLocaleState(next);
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    document.documentElement.lang = next === "ar" ? "ar" : "en";
    document.documentElement.dir = dirFor(next);
  }, []);

  // Keep the document direction in sync if the server-rendered locale changes.
  useEffect(() => {
    document.documentElement.lang = locale === "ar" ? "ar" : "en";
    document.documentElement.dir = dirFor(locale);
  }, [locale]);

  const value = useMemo<I18nValue>(() => {
    const dict = dictionaryFor(locale);
    return {
      locale,
      dir: dirFor(locale),
      dict,
      setLocale,
      t: (key, vars) => translate(dict, key, vars),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/** Convenience hook when only the translate function is needed. */
export function useT() {
  return useI18n().t;
}
