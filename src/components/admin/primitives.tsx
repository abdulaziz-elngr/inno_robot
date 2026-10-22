import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Standard page header used across the admin console. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Admin surface wrapping a page section in a card. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("surface overflow-hidden", className)}>{children}</section>;
}

export function PanelHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4", className)}>
      <div>
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function PanelBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

/** Responsive grid of metric cards (real database values only). */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "error";
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "error" ? "text-error" : "text-primary";
  return (
    <div className="surface flex items-start justify-between gap-4 p-5">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-subtle">{label}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-fg">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
      {icon && <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl bg-lavender dark:bg-primary/15", toneClass)}>{icon}</div>}
    </div>
  );
}
