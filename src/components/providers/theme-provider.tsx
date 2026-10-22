"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "inno_theme";

type ThemeValue = { theme: Theme; resolved: "light" | "dark"; setTheme: (theme: Theme) => void; toggle: () => void };
const ThemeContext = createContext<ThemeValue | null>(null);

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * Theme controller. The initial paint is handled by an inline script in the root layout
 * (no flash of the wrong theme); this provider keeps state and persistence in sync.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    // localStorage is only readable after mount (SSR renders "system" to stay consistent);
    // the actual stored preference is applied in a microtask to keep this effect body
    // free of synchronous setState.
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
      setThemeState(stored);
      apply(stored);
      setResolved(document.documentElement.classList.contains("dark") ? "dark" : "light");
    });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      apply(theme);
      setResolved(document.documentElement.classList.contains("dark") ? "dark" : "light");
    };
    media.addEventListener("change", onChange);
    return () => {
      cancelled = true;
      media.removeEventListener("change", onChange);
    };
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
    setResolved(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({
      theme,
      resolved,
      setTheme,
      toggle: () => setTheme(resolved === "dark" ? "light" : "dark"),
    }),
    [theme, resolved, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
