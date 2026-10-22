"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

/** Accessible modal: Escape closes, backdrop click closes, focus is moved into the dialog. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    focusable?.[0]?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && panel) {
        const items = panel.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
        if (!items.length) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <motion.button
            type="button"
            aria-label="Close dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={cn("relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl", className)}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
              <div>
                <h2 id={titleId} className="text-base font-semibold text-fg">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-1 text-sm text-muted">
                    {description}
                  </p>
                )}
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-subtle hover:bg-border/60 hover:text-fg">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            {children && <div className="px-5 py-4">{children}</div>}
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 px-5 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ── Promise-based confirmation used by destructive admin actions ──────────── */

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={Boolean(options)}
        onClose={() => settle(false)}
        title={options?.title ?? ""}
        description={options?.description}
        footer={
          <>
            <Button variant="outline" onClick={() => settle(false)}>
              {options?.cancelLabel ?? "Cancel"}
            </Button>
            <Button variant={options?.destructive ? "danger" : "primary"} onClick={() => settle(true)}>
              {options?.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
