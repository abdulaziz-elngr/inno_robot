import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { ROLES, createdAtCol, idCol, updatedAtCol } from "./common";

/** Administrative users (students never sign in with a password on this platform). */
export const users = pgTable(
  "users",
  {
    id: idCol(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    locale: text("locale").notNull().default("ar"),
    active: boolean("active").notNull().default(true),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email), index("users_active_idx").on(t.active)],
);

export const roles = pgTable(
  "roles",
  {
    id: idCol(),
    key: text("key").notNull(), // RoleKey
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    description: text("description"),
    system: boolean("system").notNull().default(false),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("roles_key_unique").on(t.key)],
);

export const permissions = pgTable(
  "permissions",
  {
    id: idCol(),
    key: text("key").notNull(), // e.g. "students.write"
    descriptionEn: text("description_en").notNull(),
    descriptionAr: text("description_ar").notNull(),
  },
  (t) => [uniqueIndex("permissions_key_unique").on(t.key)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("role_permissions_unique").on(t.roleId, t.permissionId)],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    assignedAt: createdAtCol(),
    assignedBy: text("assigned_by"),
  },
  (t) => [uniqueIndex("user_roles_unique").on(t.userId, t.roleId)],
);

/** Hashed session tokens — the raw token only ever lives in an httpOnly cookie. */
export const sessions = pgTable(
  "sessions",
  {
    id: idCol(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("sessions_token_unique").on(t.tokenHash), index("sessions_user_idx").on(t.userId), index("sessions_expiry_idx").on(t.expiresAt)],
);

/** Single-use password reset tokens (hashed, expiring). */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: idCol(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("reset_tokens_hash_unique").on(t.tokenHash), index("reset_tokens_user_idx").on(t.userId)],
);

/** Append-only security audit trail. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: idCol(),
    actorUserId: text("actor_user_id"),
    actorLabel: text("actor_label").notNull(), // email, "device:<id>", "simulator", "anonymous"
    action: text("action").notNull(), // e.g. "auth.login.success"
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ip: text("ip"),
    createdAt: createdAtCol(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt), index("audit_logs_action_idx").on(t.action), index("audit_logs_actor_idx").on(t.actorUserId)],
);

export const DEFAULT_ROLE_KEYS = ROLES;
