import { z } from "zod";
import { DEVICE_MODES, DEVICE_STATUSES, KNOWLEDGE_STATUSES, ROLES, STUDENT_STATUSES } from "@/server/db/schema/common";
import { codeSchema, emailSchema, idSchema, keySchema, localeSchema, longText, optionalText, paginationSchema, passwordSchema, shortText } from "./common";

export { paginationSchema } from "./common";

export const facultySchema = z.object({
  code: codeSchema,
  nameEn: shortText(120),
  nameAr: shortText(120),
  active: z.boolean().default(true),
});
export type FacultyInput = z.infer<typeof facultySchema>;

export const departmentSchema = z.object({
  facultyId: idSchema,
  code: codeSchema,
  nameEn: shortText(120),
  nameAr: shortText(120),
  active: z.boolean().default(true),
});
export type DepartmentInput = z.infer<typeof departmentSchema>;

export const studentSchema = z.object({
  universityId: codeSchema,
  nameEn: shortText(120),
  nameAr: shortText(120),
  firstNameEn: shortText(60),
  firstNameAr: shortText(60),
  email: z.union([emailSchema, z.literal("")]).optional().default(""),
  facultyId: idSchema.optional().nullable(),
  departmentId: idSchema.optional().nullable(),
  status: z.enum(STUDENT_STATUSES).default("ACTIVE"),
});
export type StudentInput = z.infer<typeof studentSchema>;

export const studentQuerySchema = paginationSchema.extend({
  status: z.enum(STUDENT_STATUSES).optional(),
  facultyId: idSchema.optional(),
});

export const buildingSchema = z.object({
  code: codeSchema,
  nameEn: shortText(120),
  nameAr: shortText(120),
  orderIndex: z.coerce.number().int().min(0).max(999).default(0),
});

export const floorSchema = z.object({
  buildingId: idSchema,
  labelEn: shortText(60),
  labelAr: shortText(60),
  orderIndex: z.coerce.number().int().min(0).max(999).default(0),
});

export const locationSchema = z.object({
  key: keySchema,
  nameEn: shortText(140),
  nameAr: shortText(140),
  descriptionEn: optionalText(2_000),
  descriptionAr: optionalText(2_000),
  directionsEn: optionalText(2_000),
  directionsAr: optionalText(2_000),
  buildingId: idSchema.optional().nullable(),
  floorId: idSchema.optional().nullable(),
  room: optionalText(40),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  imageUrl: z.union([z.string().trim().max(500), z.literal("")]).optional().default(""),
  accessibilityNotes: optionalText(500),
  published: z.boolean().default(false),
  navigable: z.boolean().default(false),
});
export type LocationInput = z.infer<typeof locationSchema>;

export const locationQuerySchema = paginationSchema.extend({
  buildingId: idSchema.optional(),
  published: z.enum(["true", "false"]).optional(),
  navigable: z.enum(["true", "false"]).optional(),
});

export const knowledgeArticleSchema = z.object({
  categoryId: idSchema.optional().nullable(),
  title: shortText(200),
  content: longText(20_000),
  language: z.enum(["ar", "en", "both"]).default("en"),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  status: z.enum(KNOWLEDGE_STATUSES).default("DRAFT"),
  sourceDocument: optionalText(500),
  reviewAt: z.string().datetime().optional().nullable(),
});
export type KnowledgeArticleInput = z.infer<typeof knowledgeArticleSchema>;

export const knowledgeQuerySchema = paginationSchema.extend({
  status: z.enum(KNOWLEDGE_STATUSES).optional(),
  categoryId: idSchema.optional(),
  language: z.enum(["ar", "en", "both"]).optional(),
});

export const knowledgeCategorySchema = z.object({
  key: codeSchema,
  nameEn: shortText(120),
  nameAr: shortText(120),
});

export const navigationDestinationSchema = z.object({
  key: keySchema,
  locationId: idSchema.optional().nullable(),
  nameEn: shortText(140),
  nameAr: shortText(140),
  requiresConfirmation: z.boolean().default(true),
  active: z.boolean().default(true),
});
export type NavigationDestinationInput = z.infer<typeof navigationDestinationSchema>;

export const navigationRouteSchema = z.object({
  destinationId: idSchema,
  mode: z.enum(["PREDEFINED", "ESCORT", "UNAVAILABLE"]).default("PREDEFINED"),
  steps: z
    .array(z.object({ en: shortText(300), ar: shortText(300) }))
    .min(1)
    .max(30),
  active: z.boolean().default(true),
});

export const registerDeviceSchema = z.object({
  deviceId: z
    .string()
    .trim()
    .min(4)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "Device id may contain letters, numbers, '-' and '_'"),
  displayName: shortText(80),
  locationId: idSchema.optional().nullable(),
  firmwareVersion: optionalText(40),
  simulated: z.boolean().default(true),
  maxSpeedPercent: z.coerce.number().int().min(10).max(100).default(60),
  safetyTimeoutSeconds: z.coerce.number().int().min(3).max(120).default(10),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

export const updateDeviceSchema = z.object({
  displayName: shortText(80).optional(),
  locationId: idSchema.optional().nullable(),
  status: z.enum(DEVICE_STATUSES).optional(),
  mode: z.enum(DEVICE_MODES).optional(),
  active: z.boolean().optional(),
  maxSpeedPercent: z.coerce.number().int().min(10).max(100).optional(),
  safetyTimeoutSeconds: z.coerce.number().int().min(3).max(120).optional(),
  firmwareVersion: optionalText(40).optional(),
});
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;

export const adminUserSchema = z.object({
  email: emailSchema,
  name: shortText(120),
  password: passwordSchema,
  roles: z.array(z.enum(ROLES)).min(1),
  active: z.boolean().default(true),
});
export type AdminUserInput = z.infer<typeof adminUserSchema>;

export const updateAdminUserSchema = z.object({
  name: shortText(120).optional(),
  roles: z.array(z.enum(ROLES)).min(1).optional(),
  active: z.boolean().optional(),
  /** Optional password reset performed by an administrator. */
  newPassword: z.union([passwordSchema, z.literal("")]).optional().default(""),
});
export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;

export const roleUpsertSchema = z.object({
  key: z.enum(ROLES),
  nameEn: shortText(80),
  nameAr: shortText(80),
  description: optionalText(300),
  permissions: z.array(z.string().min(1).max(60)).max(100),
});
export type RoleUpsertInput = z.infer<typeof roleUpsertSchema>;

export const settingsSchema = z.object({
  appName: shortText(80),
  taglineEn: optionalText(160),
  taglineAr: optionalText(160),
  defaultLocale: localeSchema,
  defaultTheme: z.enum(["light", "dark", "system"]),
  assistantEnabled: z.boolean(),
  guestModeEnabled: z.boolean(),
  conversationRetentionDays: z.coerce.number().int().min(1).max(3650),
  voiceEnabled: z.boolean(),
  requireNavigationConfirmation: z.boolean(),
  emergencyStopEnabled: z.boolean(),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const conversationQuerySchema = paginationSchema.extend({
  language: localeSchema.optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
});
