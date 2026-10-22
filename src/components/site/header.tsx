"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

const links = [
  { href: "/", key: "home" },
  { href: "/assistant", key: "assistant" },
  { href: "/campus", key: "campus" },
  { href: "/help", key: "help" },
] as const;

export function SiteHeader() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-bg/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="shrink-0" aria-label={t("common.appName")}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-lavender text-primary-deep dark:bg-primary/15 dark:text-violet" : "text-muted hover:text-fg",
                )}
              >
                {t(`public.nav.${link.key}`)}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher className="hidden sm:inline-flex" />
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-deep sm:inline-flex"
          >
            <Sparkles className="size-4" aria-hidden />
            {t("public.nav.login")}
          </Link>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted md:hidden"
            aria-expanded={open}
            aria-label={open ? t("common.closeMenu") : t("common.openMenu")}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-card md:hidden">
          <nav className="container-page flex flex-col gap-1 py-3" aria-label="Mobile">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-sm font-medium",
                  pathname === link.href ? "bg-lavender text-primary-deep dark:bg-primary/15 dark:text-violet" : "text-muted",
                )}
              >
                {t(`public.nav.${link.key}`)}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-3">
              <LocaleSwitcher />
              <Link href="/login" onClick={() => setOpen(false)} className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white">
                {t("public.nav.login")}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
