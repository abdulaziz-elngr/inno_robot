"use client";

import { cn } from "@/lib/cn";

/** Dependency-free bar chart (no charting library) with an accessible summary. */
export function BarChart({
  data,
  label,
  ariaLabel,
  height = 120,
  color = "var(--color-primary, #7C3AED)",
  className,
}: {
  data: Array<{ key: string; value: number; title?: string }>;
  label: string;
  ariaLabel: string;
  height?: number;
  color?: string;
  className?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <figure className={cn("space-y-2", className)}>
      <figcaption className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</figcaption>
      {total === 0 ? (
        <p className="text-sm text-subtle">—</p>
      ) : (
        <div className="flex items-end gap-1.5" style={{ height }} role="img" aria-label={ariaLabel}>
          {data.map((point) => (
            <div key={point.key} className="group relative flex-1">
              <div
                className="w-full rounded-t transition-opacity group-hover:opacity-80"
                style={{ height: `${Math.max(3, (point.value / max) * (height - 8))}px`, background: color }}
                title={point.title ?? `${point.key}: ${point.value}`}
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between text-[10px] text-subtle">
        <span>{data[0]?.key ?? ""}</span>
        <span>{data[data.length - 1]?.key ?? ""}</span>
      </div>
    </figure>
  );
}
