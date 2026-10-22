import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/cn";

/** Consistent empty / zero-data state. Never show fake sample numbers here. */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-14 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-2xl bg-lavender text-primary dark:bg-primary/15 dark:text-violet">
        {icon ?? <Inbox className="size-6" aria-hidden />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-fg">{title}</p>
        {description && <p className="mx-auto max-w-md text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
