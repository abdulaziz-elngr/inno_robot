"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Menu, X, ExternalLink, LogOut } from "lucide-react";
import { ADMIN_NAV } from "./nav";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/site/locale-switcher";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

export type ShellUser = {
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
};

function NavLinks({ user, onNavigate }: { user: ShellUser; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4" aria-label="Admin">
      {ADMIN_NAV.map((group) => {
        const items = group.items.filter((item) => user.permissions.includes(item.permission));
        if (!items.length) return null;
        const groupLabel = group.groupKey.startsWith("admin.nav.") ? t(group.groupKey) : t("admin.nav.dashboard");
        return (
          <div key={group.groupKey}>
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-subtle">{groupLabel}</p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = item.end ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-white shadow-[0_8px_20px_-12px_rgb(124_58_237_/_0.9)]"
                          : "text-muted hover:bg-border/60 hover:text-fg",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function UserBlock({ user, onSignOut }: { user: ShellUser; onSignOut: () => void }) {
  const { t } = useI18n();
  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-3 rounded-lg bg-border/40 px-3 py-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
          <p className="truncate text-xs text-subtle">{user.roles.join(", ") || "—"}</p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          title={t("common.signOut")}
          aria-label={t("common.signOut")}
          className="rounded-lg p-2 text-subtle transition-colors hover:bg-card hover:text-error"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Responsive admin chrome: fixed sidebar on desktop, drawer on mobile. */
export function AdminShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { t } = useI18n();

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    } finally {
      // Client-side navigation (never window.location) so the admin bundle stays mounted.
      router.push("/login");
    }
  };

  return (
    <div className="flex min-h-dvh bg-bg">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-border bg-card lg:flex">
        <div className="flex h-16 items-center border-b border-border px-4">
          <Link href="/admin">
            <Logo />
          </Link>
        </div>
        <NavLinks user={user} />
        <UserBlock user={user} onSignOut={signOut} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-ink/50" aria-label={t("common.closeMenu")} onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col border-e border-border bg-card shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <Logo />
              <button type="button" onClick={() => setOpen(false)} aria-label={t("common.closeMenu")} className="rounded-lg p-2 text-subtle hover:text-fg">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <NavLinks user={user} onNavigate={() => setOpen(false)} />
            <UserBlock user={user} onSignOut={signOut} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={t("common.openMenu")}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted lg:hidden"
            >
              <Menu className="size-4" aria-hidden />
            </button>
            <span className="text-sm font-semibold text-fg">{t("admin.shell.title")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              target="_blank"
              className="hidden items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted hover:text-fg sm:inline-flex"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              {t("admin.nav.viewSite")}
            </Link>
            <LocaleSwitcher />
            <ThemeToggle />
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted hover:text-error lg:hidden"
            >
              <LogOut className="size-3.5" aria-hidden />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      <ChevronDown className="hidden" aria-hidden />
    </div>
  );
}
