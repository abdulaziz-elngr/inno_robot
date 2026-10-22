import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import type { MESSAGE_ROLES} from "./common";
import { createdAtCol, idCol, updatedAtCol } from "./common";
import { students } from "./academics";
import { users } from "./auth";

export const conversations = pgTable(
  "conversations",
  {
    id: idCol(),
    /** Random per-browser id for guest sessions — no personal data. */
    guestId: text("guest_id"),
    studentId: text("student_id").references(() => students.id, { onDelete: "set null" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    language: text("language").notNull().default("ar"),
    messageCount: integer("message_count").notNull().default(0),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [index("conversations_student_idx").on(t.studentId), index("conversations_created_idx").on(t.createdAt)],
);

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: idCol(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").$type<(typeof MESSAGE_ROLES)[number]>().notNull(),
    content: text("content").notNull(),
    intent: text("intent"),
    /** "provider" | "knowledge-fallback" | "unconfigured" — how the answer was produced. */
    origin: text("origin"),
    createdAt: createdAtCol(),
  },
  (t) => [index("conversation_messages_conversation_idx").on(t.conversationId), index("conversation_messages_created_idx").on(t.createdAt)],
);

/** Cloudinary asset metadata. The API secret never reaches the database. */
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: idCol(),
    publicId: text("public_id").notNull(),
    url: text("url").notNull(),
    secureUrl: text("secure_url"),
    format: text("format"),
    bytes: integer("bytes"),
    width: integer("width"),
    height: integer("height"),
    folder: text("folder"),
    kind: text("kind").notNull().default("general"), // location | robot | profile | document | general
    /** true when Cloudinary is not configured: the row records a pending local upload reference. */
    pending: boolean("pending").notNull().default(false),
    uploadedById: text("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("media_assets_public_id_unique").on(t.publicId), index("media_assets_kind_idx").on(t.kind)],
);

/** Key/value application settings (JSON values). Never stores provider API keys. */
export const applicationSettings = pgTable(
  "application_settings",
  {
    key: text("key").primaryKey(),
    value: jsonb("value").$type<unknown>().notNull(),
    updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    updatedAt: updatedAtCol(),
  },
);
