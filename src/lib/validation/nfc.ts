import { z } from "zod";
import { idSchema, keySchema } from "./common";

/**
 * Payload accepted from a device (ESP32 or simulator) on POST /api/devices/nfc.
 * The card identifier is treated as an opaque *identifier*, never as a secret or proof.
 */
export const nfcEventSchema = z.object({
  cardUid: z
    .string()
    .trim()
    .min(4)
    .max(64)
    .regex(/^[A-Za-z0-9:.-]+$/, "Card UID must be alphanumeric (':' '.' '-' allowed)"),
  event: z.enum(["CARD_DETECTED", "SCAN_STARTED", "SCAN_FAILED"]).default("CARD_DETECTED"),
  /** Client-generated id used for duplicate protection across retries. */
  eventId: z.string().trim().min(8).max(64).optional(),
  scanState: z.enum(["SCANNING", "DONE"]).optional(),
});
export type NfcEventInput = z.infer<typeof nfcEventSchema>;

/** Minimum student data the backend returns to a public terminal after identification. */
export const identificationSchema = z.object({
  identified: z.boolean(),
  /** Present only when the card matched an active card of an active student. */
  student: z
    .object({
      id: idSchema,
      firstName: z.string().max(80),
      firstNameAr: z.string().max(80),
      greetingName: z.string().max(80),
      language: z.enum(["ar", "en"]),
      facultyKey: z.string().max(40).nullable(),
    })
    .nullable()
    .default(null),
  reason: z.enum(["CARD_UNKNOWN", "CARD_REVOKED", "STUDENT_INACTIVE", "OK"]).nullable().default(null),
  /** Always true when the event came from the development simulator. */
  simulated: z.boolean().default(false),
  messageEn: z.string().max(300),
  messageAr: z.string().max(300),
});
export type Identification = z.infer<typeof identificationSchema>;

/** Admin: register a card UID to a student (association workflow). */
export const associateCardSchema = z.object({
  studentId: idSchema,
  cardUid: z
    .string()
    .trim()
    .min(4)
    .max(64)
    .regex(/^[A-Za-z0-9:.-]+$/),
  label: z.string().trim().max(80).optional(),
});
export type AssociateCardInput = z.infer<typeof associateCardSchema>;

export const revokeCardSchema = z.object({
  cardId: idSchema,
  reason: z.string().trim().min(3).max(200),
});
export type RevokeCardInput = z.infer<typeof revokeCardSchema>;

export const demoIdentifySchema = z.object({
  cardUid: z.string().trim().min(4).max(64).regex(/^[A-Za-z0-9:.-]+$/),
  language: z.enum(["ar", "en"]).default("ar"),
});
export type DemoIdentifyInput = z.infer<typeof demoIdentifySchema>;

export const lookupCardSchema = z.object({ uidHash: keySchema.optional() });
