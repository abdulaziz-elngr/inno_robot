import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const fieldBase =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-fg placeholder:text-subtle transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60 disabled:bg-border/30";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldBase, "h-10", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "min-h-24 resize-y leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(fieldBase, "h-10 cursor-pointer appearance-none bg-no-repeat pe-9", className)} style={{ backgroundPosition: "right 0.75rem center" }} {...props}>
      {children}
    </select>
  );
});

export function Label({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("mb-1.5 block text-sm font-medium text-fg", className)} {...props}>
      {children}
    </label>
  );
}

/** Label + control + optional hint/error, the standard form row. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-error" aria-hidden> *</span>}
      </Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-subtle">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-error">
          {error}
        </p>
      )}
    </div>
  );
}
