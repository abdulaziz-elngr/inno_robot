"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export type ToastVariant = "success" | "error" | "warning" | "info";
export type ToastInput = { title: string; description?: string; variant?: ToastVariant; durationMs?: number };
type ToastItem = ToastInput & { id: number };

type ToastFn = (input: ToastInput) => void;
const ToastContext = createContext<ToastFn | null>(null);

const icons: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const tones: Record<ToastVariant, string> = {
  success: "border-success/30 text-success",
  error: "border-error/30 text-error",
  warning: "border-warning/35 text-warning",
  info: "border-primary/30 text-primary",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);

  const toast = useCallback<ToastFn>(
    (input) => {
      const id = Date.now() + Math.random();
      setItems((current) => [...current, { ...input, id }]);
      const duration = input.durationMs ?? (input.variant === "error" ? 7_000 : 4_500);
      setTimeout(() => remove(id), duration);
    },
    [remove],
  );

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 end-4 z-[60] flex w-full max-w-sm flex-col gap-2" role="region" aria-live="polite">
        <AnimatePresence>
          {items.map((item) => {
            const variant = item.variant ?? "info";
            const Icon = icons[variant];
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.18 }}
                className={cn("pointer-events-auto flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg", tones[variant])}
              >
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fg">{item.title}</p>
                  {item.description && <p className="mt-0.5 text-xs text-muted">{item.description}</p>}
                </div>
                <button type="button" onClick={() => remove(item.id)} aria-label="Dismiss" className="rounded p-0.5 text-subtle hover:text-fg">
                  <X className="size-3.5" aria-hidden />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
