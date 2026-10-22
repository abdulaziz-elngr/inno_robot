import { z } from "zod";
import { COMMAND_TYPES } from "@/server/db/schema/common";
import { idSchema, keySchema } from "./common";

/** Movement speeds are bounded by the administrator-configured device limit at runtime. */
const speedPercent = z.coerce.number().int().min(0).max(100);
const durationMs = z.coerce.number().int().min(100).max(10_000);
const headingDegrees = z.coerce.number().int().min(-180).max(180);

const payloadSchemas = {
  MOVE_FORWARD: z.object({ distanceCm: z.coerce.number().min(5).max(500).optional(), durationMs: durationMs.optional() }),
  MOVE_BACKWARD: z.object({ distanceCm: z.coerce.number().min(5).max(500).optional(), durationMs: durationMs.optional() }),
  TURN_LEFT: z.object({ degrees: headingDegrees.optional() }),
  TURN_RIGHT: z.object({ degrees: headingDegrees.optional() }),
  STOP: z.object({ reason: z.string().max(120).optional() }),
  SET_SPEED: z.object({ speedPercent }),
  NAVIGATE_TO: z.object({
    destinationKey: keySchema,
    /** Set after the student/operator confirmed the destination. */
    confirmed: z.boolean().optional().default(false),
  }),
  RETURN_TO_HOME: z.object({}),
  CHANGE_MODE: z.object({ mode: z.enum(["ASSISTANT", "MANUAL", "NAVIGATION", "CHARGING", "MAINTENANCE"]) }),
} as const satisfies Record<(typeof COMMAND_TYPES)[number], z.ZodType>;

export type CommandPayloadMap = { [K in keyof typeof payloadSchemas]: z.infer<(typeof payloadSchemas)[K]> };

/** Validates the payload for a given command type (unknown types are rejected outright). */
export function parseCommandPayload(type: string, payload: unknown): { ok: true; payload: unknown } | { ok: false; error: string } {
  const schema = (payloadSchemas as Record<string, z.ZodType | undefined>)[type];
  if (!schema) return { ok: false, error: `Unsupported command type: ${type}` };
  const result = schema.safeParse(payload ?? {});
  if (!result.success) return { ok: false, error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  return { ok: true, payload: result.data };
}

export const createCommandSchema = z.object({
  deviceId: idSchema,
  type: z.enum(COMMAND_TYPES),
  payload: z.record(z.string(), z.unknown()).default({}),
  /** Operators must explicitly opt into manual control before movement commands. */
  manualModeAcknowledged: z.boolean().optional().default(false),
  /** Navigation commands require explicit confirmation when the destination demands it. */
  confirmNavigation: z.boolean().optional().default(false),
  ttlSeconds: z.coerce.number().int().min(5).max(600).default(60),
});
export type CreateCommandInput = z.infer<typeof createCommandSchema>;

export const commandAckSchema = z.object({
  status: z.enum(["ACKNOWLEDGED", "EXECUTING", "COMPLETED", "FAILED"]),
  failureReason: z.string().max(300).optional(),
  /** Device-reported state after the command (backend never invents this). */
  deviceStatus: z.enum(["ONLINE", "OFFLINE", "IDLE", "BUSY", "MOVING", "CHARGING", "ERROR", "MAINTENANCE"]).optional(),
  batteryPercent: z.coerce.number().int().min(0).max(100).optional(),
  /** Verified physical stop reported by the device itself. */
  stopped: z.boolean().optional(),
});
export type CommandAckInput = z.infer<typeof commandAckSchema>;

export const cancelCommandSchema = z.object({ commandId: idSchema });

export const telemetrySchema = z.object({
  batteryPercent: z.coerce.number().int().min(0).max(100).optional(),
  speedPercent: z.coerce.number().int().min(0).max(100).optional(),
  obstacleDistanceCm: z.coerce.number().int().min(0).max(4_000).optional(),
  mode: z.enum(["ASSISTANT", "MANUAL", "NAVIGATION", "CHARGING", "MAINTENANCE"]).optional(),
  status: z.enum(["ONLINE", "OFFLINE", "IDLE", "BUSY", "MOVING", "CHARGING", "ERROR", "MAINTENANCE"]).optional(),
  firmwareVersion: z.string().max(40).optional(),
});
export type TelemetryInput = z.infer<typeof telemetrySchema>;
