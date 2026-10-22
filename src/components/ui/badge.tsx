import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "outline" | "simulated";

const styles: Record<BadgeVariant, string> = {
  default: "bg-lavender text-primary-deep dark:bg-primary/20 dark:text-violet",
  success: "bg-success/12 text-success border border-success/25",
  warning: "bg-warning/15 text-warning border border-warning/30",
  error: "bg-error/12 text-error border border-error/25",
  info: "bg-violet/15 text-primary-deep dark:text-violet border border-violet/25",
  outline: "border border-border text-muted",
  simulated: "bg-warning/15 text-warning border border-warning/40 uppercase tracking-wide text-[10px] font-bold",
};

export function Badge({ variant = "default", className, ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", styles[variant], className)}
      {...props}
    />
  );
}

/** Colour + text status mapping shared by tables and detail pages. */
export function statusVariant(status: string): BadgeVariant {
  switch (status.toUpperCase()) {
    case "ACTIVE":
    case "ONLINE":
    case "IDLE":
    case "COMPLETED":
    case "PUBLISHED":
      return "success";
    case "OFFLINE":
    case "REVOKED":
    case "FAILED":
    case "ARCHIVED":
    case "CANCELLED":
    case "EXPIRED":
    case "ERROR":
      return "error";
    case "MOVING":
    case "BUSY":
    case "EXECUTING":
    case "SENT":
    case "DRAFT":
      return "info";
    case "PENDING":
    case "ACKNOWLEDGED":
    case "WARNING":
    case "CHARGING":
    case "LOST":
    case "MAINTENANCE":
      return "warning";
    case "INACTIVE":
    case "OFFLINE_DEVICE":
      return "outline";
    default:
      return "default";
  }
}
