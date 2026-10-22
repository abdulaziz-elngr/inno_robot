import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { index, text, timestamp, type AnyPgColumn } from "drizzle-orm/pg-core";

/** Application-generated stable IDs (portable across Neon and the embedded dev database). */
export const newId = () => randomUUID();

/** Primary key column. */
export const idCol = () => text("id").primaryKey();

/** `created_at` column. */
export const createdAtCol = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** `updated_at` column — services refresh it explicitly on update. */
export const updatedAtCol = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/** `now()` SQL fragment for defaults written through raw SQL migrations. */
export const nowDefault = sql`now()`;

/** ISO language code supported by the platform. */
export type Locale = "ar" | "en";

export const ROLES = ["SUPER_ADMIN", "ADMIN", "UNIVERSITY_STAFF", "ROBOT_OPERATOR", "CONTENT_MANAGER", "VIEWER"] as const;
export type RoleKey = (typeof ROLES)[number];

export const STUDENT_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const CARD_STATUSES = ["ACTIVE", "REVOKED", "LOST", "EXPIRED"] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

export const DEVICE_STATUSES = ["ONLINE", "OFFLINE", "IDLE", "BUSY", "MOVING", "CHARGING", "ERROR", "MAINTENANCE"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const DEVICE_MODES = ["ASSISTANT", "MANUAL", "NAVIGATION", "CHARGING", "MAINTENANCE"] as const;
export type DeviceMode = (typeof DEVICE_MODES)[number];

export const COMMAND_TYPES = [
  "MOVE_FORWARD",
  "MOVE_BACKWARD",
  "TURN_LEFT",
  "TURN_RIGHT",
  "STOP",
  "SET_SPEED",
  "NAVIGATE_TO",
  "RETURN_TO_HOME",
  "CHANGE_MODE",
] as const;
export type CommandType = (typeof COMMAND_TYPES)[number];

export const COMMAND_STATUSES = [
  "PENDING",
  "SENT",
  "ACKNOWLEDGED",
  "EXECUTING",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
] as const;
export type CommandStatus = (typeof COMMAND_STATUSES)[number];

export const KNOWLEDGE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export const MESSAGE_ROLES = ["USER", "ASSISTANT", "SYSTEM"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

/** Common index helper: index on `created_at` for time-ordered listings. */
export const createdAtIndex = (name: string, col: AnyPgColumn) => index(name).on(col);
