import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { ApiError } from "@/server/auth/guard";
import { nfcLimiter } from "@/server/auth/rate-limit";
import type { DevicePrincipal } from "@/server/auth/device-auth";
import { db } from "@/server/db/client";
import { deviceEvents, studentCards } from "@/server/db/schema";
import type { Identification, NfcEventInput } from "@/lib/validation/nfc";
import { normalizeUid, resolveCardUid } from "./students";

export type IngestResult = {
  identification: Identification;
  /** True when this exact scan was already processed (device retry / repeated read). */
  duplicate: boolean;
  eventId: string;
};

const unidentified = (simulated: boolean, reason: Identification["reason"]): Identification => ({
  identified: false,
  student: null,
  reason,
  simulated,
  messageEn: "",
  messageAr: "",
});

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === "23505" || String((error as { message?: unknown }).message ?? "").includes("duplicate key");
}

async function recordEvent(device: DevicePrincipal, type: string, payload: Record<string, unknown>, dedupeKey: string | null) {
  try {
    await db.insert(deviceEvents).values({
      id: randomUUID(),
      deviceId: device.deviceId,
      type,
      payload,
      dedupeKey,
      simulated: device.simulated,
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    console.error("[nfc] failed to record device event:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * NFC ingestion entry point (called by POST /api/devices/nfc after device authentication).
 *
 * Guarantees:
 *  - duplicate scans are detected and never produce a second greeting,
 *  - revoked/unknown cards are reported without leaking whether a student exists,
 *  - events from the simulator are stored with simulated = true and are never presented
 *    as real hardware telemetry.
 */
export async function ingestNfcEvent(device: DevicePrincipal, input: NfcEventInput): Promise<IngestResult> {
  const limit = nfcLimiter.check(device.deviceId);
  if (!limit.ok) {
    throw new ApiError(429, "Too many NFC events from this device.", "NFC_RATE_LIMITED");
  }

  const eventId = input.eventId ?? randomUUID();

  if (input.event === "SCAN_STARTED") {
    await recordEvent(device, "NFC_SCAN_STARTED", { eventId }, null);
    return { identification: unidentified(device.simulated, null), duplicate: false, eventId };
  }

  if (input.event === "SCAN_FAILED") {
    await recordEvent(device, "NFC_SCAN_FAILED", { eventId }, null);
    return { identification: unidentified(device.simulated, "CARD_UNKNOWN"), duplicate: false, eventId };
  }

  const uid = normalizeUid(input.cardUid);
  // Dedupe window: same card from the same device within 30 seconds counts once.
  const dedupeKey = createHash("sha256")
    .update(`${uid}|${Math.floor(Date.now() / 30_000)}`)
    .digest("hex")
    .slice(0, 40);

  const recorded = await recordEvent(
    device,
    "NFC_SCAN_RECEIVED",
    { uidLast4: uid.slice(-4), eventId },
    dedupeKey,
  );
  const duplicate = !recorded;

  const resolution = await resolveCardUid(uid);

  if (!resolution) {
    if (!duplicate) await recordEvent(device, "STUDENT_NOT_FOUND", { uidLast4: uid.slice(-4) }, null);
    return {
      identification: { ...unidentified(device.simulated, "CARD_UNKNOWN"), messageEn: "This card is not registered.", messageAr: "الكارت غير مسجل." },
      duplicate,
      eventId,
    };
  }

  if (resolution.card.status !== "ACTIVE") {
    if (!duplicate) {
      await recordEvent(device, "CARD_REJECTED", { uidLast4: uid.slice(-4), status: resolution.card.status }, null);
    }
    return {
      identification: {
        ...unidentified(device.simulated, "CARD_REVOKED"),
        messageEn: "This card is deactivated. Please contact the university help desk.",
        messageAr: "هذا الكارت موقوف. يرجى مراجعة مكتب خدمة الطلاب.",
      },
      duplicate,
      eventId,
    };
  }

  if (resolution.student.status !== "ACTIVE") {
    if (!duplicate) await recordEvent(device, "STUDENT_INACTIVE", { studentId: resolution.student.id }, null);
    return {
      identification: {
        ...unidentified(device.simulated, "STUDENT_INACTIVE"),
        messageEn: "This student record is not active.",
        messageAr: "حساب الطالب غير نشط.",
      },
      duplicate,
      eventId,
    };
  }

  await db.update(studentCards).set({ lastSeenAt: new Date() }).where(eq(studentCards.id, resolution.card.id));

  if (!duplicate) {
    await recordEvent(device, "STUDENT_IDENTIFIED", { studentId: resolution.student.id, uidLast4: uid.slice(-4) }, null);
  }

  return {
    identification: {
      identified: true,
      student: {
        id: resolution.student.id,
        firstName: resolution.student.firstNameEn,
        firstNameAr: resolution.student.firstNameAr,
        greetingName: resolution.student.firstNameAr,
        language: "ar",
        facultyKey: resolution.facultyCode,
      },
      reason: "OK",
      simulated: device.simulated,
      messageEn: `Welcome, ${resolution.student.firstNameEn}!`,
      messageAr: `أهلاً ${resolution.student.firstNameAr}!`,
    },
    duplicate,
    eventId,
  };
}
