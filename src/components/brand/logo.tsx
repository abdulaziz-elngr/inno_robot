import { cn } from "@/lib/cn";

/**
 * Inno Robot brand mark: pearl-white head, glossy black face, glowing violet eyes.
 * Used in navigation, login and document headers.
 */
export function RobotMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-9", className)} role={title ? "img" : "presentation"} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id="mark-shell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E9E5F6" />
        </linearGradient>
        <linearGradient id="mark-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1B1830" />
          <stop offset="100%" stopColor="#0B0A14" />
        </linearGradient>
        <radialGradient id="mark-eye" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#DDD3FF" />
          <stop offset="60%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#7C3AED" />
        </radialGradient>
      </defs>
      {/* headband */}
      <path d="M9 22a15 15 0 0 1 30 0" fill="none" stroke="#7C3AED" strokeWidth="3.2" strokeLinecap="round" />
      {/* ear cups */}
      <rect x="4.5" y="19" width="7" height="12" rx="3.5" fill="#4C1D95" />
      <rect x="36.5" y="19" width="7" height="12" rx="3.5" fill="#4C1D95" />
      {/* shell */}
      <rect x="9" y="13" width="30" height="26" rx="12" fill="url(#mark-shell)" stroke="#D8D2EE" />
      {/* face screen */}
      <rect x="13" y="17.5" width="22" height="17" rx="8" fill="url(#mark-face)" />
      {/* eyes */}
      <ellipse cx="19.4" cy="25" rx="2.5" ry="3" fill="url(#mark-eye)" />
      <ellipse cx="28.6" cy="25" rx="2.5" ry="3" fill="url(#mark-eye)" />
      {/* smile */}
      <path d="M20 29.4q4 3.2 8 0" fill="none" stroke="#A78BFA" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Wordmark used in the site header and login screens. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <RobotMark className="size-9" title="Inno Robot" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight text-fg">Inno Robot</span>
          <span className="text-[10px] font-medium tracking-wide text-primary">UNIVERSITY ASSISTANT</span>
        </span>
      )}
    </span>
  );
}
