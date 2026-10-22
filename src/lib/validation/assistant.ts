import { z } from "zod";
import { localeSchema } from "./common";

/**
 * Structured answer produced by the AI provider (or the knowledge fallback).
 * Every assistant answer is parsed with this schema before it reaches the client —
 * an unparsable model output is treated as an error, never rendered raw.
 */
export const assistantIntentSchema = z.enum([
  "GENERAL_QUESTION",
  "LOCATION_LOOKUP",
  "NAVIGATION_REQUEST",
  "UNIVERSITY_INFORMATION",
  "STUDENT_INFORMATION",
  "HUMAN_ASSISTANCE_REQUEST",
]);
export type AssistantIntent = z.infer<typeof assistantIntentSchema>;

export const aiResponseSchema = z.object({
  message: z.string().min(1).max(4_000),
  language: localeSchema,
  intent: assistantIntentSchema,
  destinationId: z.string().max(64).nullable().default(null),
  requiresConfirmation: z.boolean().default(false),
  spokenResponse: z.string().min(1).max(4_000),
  /** Set when the model could not verify the information from the knowledge base. */
  unverified: z.boolean().default(false),
  /** Optional source references (published knowledge article titles). */
  sources: z.array(z.string().max(200)).max(5).default([]),
});
export type AIResponse = z.infer<typeof aiResponseSchema>;

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(2_000),
  conversationId: z.string().trim().max(64).optional(),
  guestId: z.string().trim().max(64).optional(),
  language: localeSchema,
  /** Present only when the NFC workflow identified the student for this session. */
  studentId: z.string().trim().max(64).optional(),
  /** When true the client asks for the navigation leg of the answer to be executed. */
  confirmNavigation: z.boolean().optional().default(false),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Public description of the AI provider state, consumed by the assistant UI. */
export const aiStatusSchema = z.object({
  configured: z.boolean(),
  provider: z.string().max(80).nullable(),
  model: z.string().max(120).nullable(),
  knowledgeArticles: z.number().int().nonnegative(),
  fallbackMode: z.boolean(),
});
export type AIStatus = z.infer<typeof aiStatusSchema>;
