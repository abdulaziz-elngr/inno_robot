import { z } from "zod";

export const localeSchema = z.enum(["ar", "en"]);
export type LocaleInput = z.infer<typeof localeSchema>;

/** Human-facing identifier limits shared across the platform. */
export const shortText = (max = 120) => z.string().trim().min(1).max(max);
export const longText = (max = 20_000) => z.string().trim().min(1).max(max);
export const optionalText = (max = 2_000) => z.string().trim().max(max).optional().default("");
export const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/, "Only letters, numbers, '-' and '_' are allowed");

/** Machine key used by the assistant (e.g. MAIN_LIBRARY). */
export const keySchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Z0-9_]+$/, "Keys are UPPERCASE_SNAKE_CASE");

export const emailSchema = z.string().trim().toLowerCase().min(5).max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address");

export const passwordSchema = z.string().min(12, "At least 12 characters").max(200);

export const idSchema = z.string().trim().min(1).max(64);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional().default(""),
});

export type Pagination = z.infer<typeof paginationSchema>;

/** Query-string boolean coercion ("true"/"1"). */
export const boolish = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");
