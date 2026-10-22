import { z } from "zod";
import { emailSchema, localeSchema, passwordSchema } from "./common";

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
  remember: z.boolean().optional().default(true),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(10).max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const preferencesSchema = z.object({
  locale: localeSchema,
  theme: z.enum(["light", "dark", "system"]).optional(),
  reducedMotion: z.boolean().optional(),
});
export type PreferencesInput = z.infer<typeof preferencesSchema>;
