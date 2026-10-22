import type { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-border/40 text-start", className)} {...props} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className="divide-y divide-border/70" {...props} />;
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors hover:bg-lavender/40 dark:hover:bg-primary/10", className)} {...props} />;
}

export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn("px-4 py-3 text-start text-xs font-semibold tracking-wide text-muted uppercase", className)}
      {...props}
    />
  );
}

export function TD({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 align-middle text-fg", className)} {...props} />;
}
