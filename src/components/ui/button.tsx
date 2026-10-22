import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon" | "icon-lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-deep active:bg-primary-deep shadow-[0_8px_24px_-12px_rgb(124_58_237_/_0.7)]",
  secondary: "bg-lavender text-primary-deep hover:bg-violet/25 dark:bg-primary/15 dark:text-violet dark:hover:bg-primary/25",
  outline: "border border-border bg-card text-fg hover:border-primary/50 hover:text-primary",
  ghost: "text-muted hover:bg-border/60 hover:text-fg",
  danger: "bg-error text-white hover:bg-error/90",
  link: "text-primary underline-offset-4 hover:underline p-0 h-auto",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-base rounded-xl gap-2",
  icon: "h-9 w-9 rounded-lg",
  "icon-lg": "h-12 w-12 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading = false, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors duration-150 select-none",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
