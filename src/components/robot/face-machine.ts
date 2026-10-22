/**
 * Robot face state machine.
 *
 * The face is a pure function of a single `FaceState`. Platform events (NFC scans,
 * chat activity, commands, device telemetry) are mapped to states here so the face
 * always reflects *real* platform activity — it never fakes being busy.
 */

export const FACE_STATES = [
  "IDLE",
  "SCANNING",
  "GREETING",
  "LISTENING",
  "THINKING",
  "SPEAKING",
  "NAVIGATING",
  "SUCCESS",
  "WARNING",
  "ERROR",
  "OFFLINE",
] as const;

export type FaceState = (typeof FACE_STATES)[number];

/** Events the platform emits; each maps to a target state (and optional auto-return). */
export type FaceEvent =
  | { type: "PLATFORM_EVENT"; name: string }
  | { type: "NFC_SCAN_STARTED" }
  | { type: "NFC_CARD_READ"; identified: boolean }
  | { type: "GREET" }
  | { type: "LISTEN_START" }
  | { type: "LISTEN_STOP" }
  | { type: "THINK_START" }
  | { type: "SPEAK_START" }
  | { type: "SPEAK_END" }
  | { type: "NAVIGATION_STARTED"; destination: string }
  | { type: "NAVIGATION_ENDED" }
  | { type: "COMMAND_COMPLETED" }
  | { type: "COMMAND_FAILED" }
  | { type: "WARNING"; message?: string }
  | { type: "DEVICE_OFFLINE" }
  | { type: "DEVICE_ONLINE" }
  | { type: "RESET" };

export type FaceSnapshot = {
  state: FaceState;
  /** Milliseconds after which the state auto-reverts to `IDLE` (null = sticky). */
  revertInMs: number | null;
  /** Contextual detail (destination name, failure text) for the status line. */
  detail: string | null;
};

/**
 * Maps a platform event to the face snapshot it triggers.
 * Transient states (greeting, success, warning) automatically return to IDLE;
 * error/offline are sticky until an explicit recovery event arrives.
 */
export function reduceFaceEvent(current: FaceState, event: FaceEvent): FaceSnapshot {
  const idle: FaceSnapshot = { state: "IDLE", revertInMs: null, detail: null };

  switch (event.type) {
    case "NFC_SCAN_STARTED":
      return { state: "SCANNING", revertInMs: 8_000, detail: null };

    case "NFC_CARD_READ":
      return event.identified
        ? { state: "GREETING", revertInMs: 2_500, detail: null }
        : { state: "WARNING", revertInMs: 4_000, detail: null };

    case "GREET":
      return { state: "GREETING", revertInMs: 2_500, detail: null };

    case "LISTEN_START":
      return { state: "LISTENING", revertInMs: null, detail: null };

    case "LISTEN_STOP":
      return { state: "THINKING", revertInMs: 15_000, detail: null };

    case "THINK_START":
      return { state: "THINKING", revertInMs: 30_000, detail: null };

    case "SPEAK_START":
      return { state: "SPEAKING", revertInMs: null, detail: null };

    case "SPEAK_END":
      return idle;

    case "NAVIGATION_STARTED":
      return { state: "NAVIGATING", revertInMs: null, detail: event.destination };

    case "NAVIGATION_ENDED":
      return { state: "SUCCESS", revertInMs: 2_500, detail: null };

    case "COMMAND_COMPLETED":
      return { state: "SUCCESS", revertInMs: 2_000, detail: null };

    case "COMMAND_FAILED":
      // A failed command may not override an active emergency/offline face.
      if (current === "OFFLINE" || current === "ERROR") return { state: current, revertInMs: null, detail: event.type };
      return { state: "ERROR", revertInMs: null, detail: null };

    case "WARNING":
      if (current === "OFFLINE") return { state: current, revertInMs: null, detail: event.message ?? null };
      return { state: "WARNING", revertInMs: 4_000, detail: event.message ?? null };

    case "DEVICE_OFFLINE":
      return { state: "OFFLINE", revertInMs: null, detail: null };

    case "DEVICE_ONLINE":
      return idle;

    case "RESET":
      return idle;

    case "PLATFORM_EVENT": {
      // Any other platform event briefly animates the face from its current state.
      const base = current === "ERROR" || current === "OFFLINE" ? current : "IDLE";
      return { state: base, revertInMs: base === "IDLE" ? 1_500 : null, detail: null };
    }
    default:
      return idle;
  }
}

/** True while the face shows a state that claims active robot/AI work. */
export function isActiveState(state: FaceState): boolean {
  return state === "SCANNING" || state === "LISTENING" || state === "THINKING" || state === "SPEAKING" || state === "NAVIGATING";
}

/** Per-state accent color (token name) used by the face + status line. */
export function accentFor(state: FaceState): string {
  switch (state) {
    case "SUCCESS":
      return "var(--color-success)";
    case "WARNING":
      return "var(--color-warning)";
    case "ERROR":
      return "var(--color-error)";
    case "OFFLINE":
      return "var(--subtle)";
    default:
      return "var(--color-primary)";
  }
}
