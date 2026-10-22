"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";
import { accentFor, type FaceState } from "./face-machine";

/**
 * RobotFace — an animated SVG robot face with 11 states.
 *
 * Every visual change is driven by the `state` prop (a pure function of real platform
 * events, see face-machine.ts). Colors come from design tokens so it matches light and
 * dark themes; motion respects the global reduced-motion rules.
 */
export const RobotFace = memo(function RobotFace({
  state,
  size = 220,
  className,
  title,
}: {
  state: FaceState;
  /** Rendered width/height in px. */
  size?: number;
  className?: string;
  /** Optional accessible label; defaults to the state name. */
  title?: string;
}) {
  const accent = accentFor(state);
  const offline = state === "OFFLINE";
  const error = state === "ERROR";
  const warning = state === "WARNING";
  const success = state === "SUCCESS";
  const navigating = state === "NAVIGATING";
  const scanning = state === "SCANNING";
  const listening = state === "LISTENING";
  const thinking = state === "THINKING";
  const speaking = state === "SPEAKING";
  const greeting = state === "GREETING";

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={title ?? `Robot face: ${state.toLowerCase()}`}
      className={cn("select-none", className)}
      style={{ ["--face-accent" as string]: accent }}
    >
      <defs>
        <linearGradient id="face-shell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--card)" />
          <stop offset="100%" stopColor="color-mix(in srgb, var(--card) 70%, var(--border))" />
        </linearGradient>
        <radialGradient id="face-glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="var(--screen-glow)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <clipPath id="face-clip">
          <rect x="30" y="42" width="140" height="104" rx="30" />
        </clipPath>
        <style>{`
          @keyframes face-blink { 0%, 92%, 100% { transform: scaleY(1); } 95%, 97% { transform: scaleY(0.08); } }
          @keyframes face-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
          @keyframes face-scan { 0% { transform: translateY(-60px); opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { transform: translateY(70px); opacity: 0; } }
          @keyframes face-wave { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
          @keyframes face-pulse { 0% { transform: scale(0.92); opacity: 0.9; } 100% { transform: scale(1.25); opacity: 0; } }
          @keyframes face-think-dot { 0%, 100% { opacity: 0.25; } 40% { opacity: 1; } }
          @keyframes face-look { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
          @keyframes face-tip { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
          .face-eyes { transform-origin: center; animation: face-blink 5s ease-in-out infinite; }
          .face-body { animation: face-float 5s ease-in-out infinite; }
          .face-scanline { animation: face-scan 1.6s linear infinite; }
          .face-wave-bar { transform-origin: center; animation: face-wave 0.9s ease-in-out infinite; }
          .face-pulse-ring { transform-origin: 100px 94px; animation: face-pulse 1.4s ease-out infinite; }
          .face-think-dot { animation: face-think-dot 1.1s ease-in-out infinite; }
          .face-look { animation: face-look 2.4s ease-in-out infinite; }
          .face-tip { animation: face-tip 1.8s ease-in-out infinite; }
        `}</style>
      </defs>

      {/* Antenna */}
      <g className="face-body">
        <line x1="100" y1="42" x2="100" y2="24" stroke="var(--border)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="100" cy="20" r="6" fill={offline ? "var(--subtle)" : accent} className={offline ? "" : "face-tip"} />
        {!offline && <circle cx="100" cy="20" r="10" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.35" />}
      </g>

      {/* Head shell */}
      <rect x="22" y="34" width="156" height="126" rx="40" fill="url(#face-shell)" stroke={error ? "var(--color-error)" : warning ? "var(--color-warning)" : "var(--border)"} strokeWidth={error || warning ? 3 : 2} />

      {/* Screen */}
      <g clipPath="url(#face-clip)">
        <rect x="30" y="42" width="140" height="104" rx="30" fill={offline ? "color-mix(in srgb, var(--card) 85%, var(--border))" : "var(--bg)"} />
        {!offline && <rect x="30" y="42" width="140" height="104" rx="30" fill="url(#face-glow)" />}

        {/* Scan line (SCANNING) */}
        {scanning && <rect className="face-scanline" x="30" y="70" width="140" height="6" rx="3" fill={accent} opacity="0.7" />}

        {/* Eyes */}
        <g className={cn("face-eyes", thinking && "face-look")} fill={offline ? "var(--subtle)" : accent}>
          {error ? (
            /* X eyes */
            <g stroke={accent} strokeWidth="7" strokeLinecap="round">
              <line x1="58" y1="80" x2="82" y2="104" /><line x1="82" y1="80" x2="58" y2="104" />
              <line x1="118" y1="80" x2="142" y2="104" /><line x1="142" y1="80" x2="118" y2="104" />
            </g>
          ) : greeting || success ? (
            /* Happy arc eyes */
            <g fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round">
              <path d="M60 96 Q71 82 82 96" /><path d="M118 96 Q129 82 140 96" />
            </g>
          ) : warning ? (
            /* One squinting eye */
            <>
              <circle cx="71" cy="92" r="9" />
              <rect x="114" y="89" width="28" height="6" rx="3" />
            </>
          ) : listening || navigating ? (
            /* Wide eyes with ring */
            <>
              <circle cx="71" cy="92" r="11" />
              <circle cx="71" cy="92" r="16" fill="none" stroke={accent} strokeWidth="2" opacity="0.4" />
              <circle cx="129" cy="92" r="11" />
              <circle cx="129" cy="92" r="16" fill="none" stroke={accent} strokeWidth="2" opacity="0.4" />
            </>
          ) : (
            /* Default rounded eyes */
            <>
              <rect x="58" y="82" width="26" height="22" rx="11" />
              <rect x="116" y="82" width="26" height="22" rx="11" />
            </>
          )}
        </g>

        {/* Mouth / status bar */}
        {speaking ? (
          /* Voice wave */
          <g fill={accent}>
            {[76, 90, 104, 118, 132].map((x, i) => (
              <rect key={x} className="face-wave-bar" x={x} y={122} width="6" height="16" rx="3" style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </g>
        ) : thinking ? (
          /* Thinking dots */
          <g fill={accent}>
            {[85, 100, 115].map((x, i) => (
              <circle key={x} className="face-think-dot" cx={x} cy={130} r="4.5" style={{ animationDelay: `${i * 0.25}s` }} />
            ))}
          </g>
        ) : (
          <rect x={greeting || success ? 78 : 82} y={greeting || success ? 122 : 126} width={greeting || success ? 44 : 36} height="7" rx="3.5" fill={offline ? "var(--border)" : accent} opacity={offline ? 1 : 0.85} />
        )}

        {/* Success pulse ring */}
        {success && <circle className="face-pulse-ring" cx="100" cy="94" r="52" fill="none" stroke={accent} strokeWidth="3" />}
      </g>

      {/* Ears / side panels */}
      <rect x="10" y="76" width="10" height="34" rx="5" fill="var(--border)" />
      <rect x="180" y="76" width="10" height="34" rx="5" fill="var(--border)" />

      {/* Neck */}
      <rect x="84" y="160" width="32" height="14" rx="6" fill="var(--border)" />
      <rect x="66" y="172" width="68" height="10" rx="5" fill="color-mix(in srgb, var(--border) 70%, var(--card))" />
    </svg>
  );
});
