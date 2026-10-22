"use client";

import { cn } from "@/lib/cn";

/** Accessible on/off control (button with role="switch"). */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-border",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block size-5 transform rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5.5 rtl:-translate-x-5.5" : "translate-x-0.5",
        )}
        aria-hidden
      />
    </button>
  );
}
