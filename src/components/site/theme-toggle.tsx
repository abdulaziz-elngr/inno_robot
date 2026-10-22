"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { useI18n } from "@/lib/i18n/provider";

export function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={resolved === "dark" ? t("common.light") : t("common.dark")}
      title={resolved === "dark" ? t("common.light") : t("common.dark")}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted transition-colors hover:text-fg"
    >
      {resolved === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  );
}
