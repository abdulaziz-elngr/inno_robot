import { cn } from "@/lib/cn";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton h-4 w-full", className)} {...props} />;
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={cn("h-4 flex-1", c === 0 && "max-w-40")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-block size-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary", className)}
    />
  );
}
