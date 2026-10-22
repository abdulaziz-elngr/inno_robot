import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestDb, initTestDb, uid } from "./helpers/db";

/**
 * NFC ingestion guarantees:
 *  - duplicate scans (device retry / repeated read) never produce a second greeting,
 *  - revoked and unknown cards are reported without leaking whether a student exists,
 *  - simulator events are always flagged simulated.
 */

const DEVICE = { deviceId: "INNO-TEST", displayName: "Test Robot", simulated: true, active: true };

describe("NFC ingestion", () => {
  let db: Awaited<ReturnType<typeof initTestDb>>;
  let studentId: string;
  const CARD = "04AA11BB22CC";
  const REVOKED_CARD = "04AA11BB22DD";
  const DUP_CARD = "04AA11BB22EE";
  const EVENTID_CARD = "04AA11BB22FF";

  beforeAll(async () => {
    db = await initTestDb();
    const { createStudent, associateCard, revokeCard } = await import("@/server/services/students");
    const { robotDevices } = await import("@/server/db/schema");

    await db.insert(robotDevices).values({ id: uid("dev"), deviceId: DEVICE.deviceId, displayName: DEVICE.displayName, simulated: true, active: true });

    studentId = await createStudent(
      { universityId: uid("STU"), nameEn: "Nfc Student", nameAr: "طالب نف ك", firstNameEn: "Nfc", firstNameAr: "نف", email: "", facultyId: null, departmentId: null, status: "ACTIVE" },
      uid("actor"),
    );
    await associateCard({ studentId, cardUid: CARD }, uid("actor"));
    // Each dedupe test gets its own card so the 30-second dedupe window never leaks
    // a scan from a previous test into the next one.
    await associateCard({ studentId, cardUid: DUP_CARD }, uid("actor"));
    await associateCard({ studentId, cardUid: EVENTID_CARD }, uid("actor"));
    const revoked = await associateCard({ studentId, cardUid: REVOKED_CARD }, uid("actor"));
    await revokeCard({ cardId: revoked.id, reason: "stolen" }, uid("actor"));
  });

  afterAll(cleanupTestDb);

  it("identifies a student from an active card", async () => {
    const { ingestNfcEvent } = await import("@/server/services/nfc");
    const result = await ingestNfcEvent(DEVICE, { cardUid: CARD, event: "CARD_DETECTED", eventId: uid("evt") });

    expect(result.duplicate).toBe(false);
    expect(result.identification.identified).toBe(true);
    expect(result.identification.student?.id).toBe(studentId);
    expect(result.identification.reason).toBe("OK");
    // Simulator traffic is never presented as real hardware.
    expect(result.identification.simulated).toBe(true);
    // No raw UID in the response.
    expect(JSON.stringify(result.identification)).not.toContain(CARD);
  });

  it("flags a repeated scan of the same card as a duplicate", async () => {
    const { ingestNfcEvent } = await import("@/server/services/nfc");
    const first = await ingestNfcEvent(DEVICE, { cardUid: DUP_CARD, event: "CARD_DETECTED", eventId: uid("evt") });
    const second = await ingestNfcEvent(DEVICE, { cardUid: DUP_CARD, event: "CARD_DETECTED", eventId: uid("evt") });

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    // The student is still resolved so the terminal can keep showing the greeting,
    // but the duplicate flag tells the UI not to re-announce.
    expect(second.identification.identified).toBe(true);
  });

  it("honours an explicit eventId for cross-retry dedupe", async () => {
    const { ingestNfcEvent } = await import("@/server/services/nfc");
    const eventId = uid("evt");
    const first = await ingestNfcEvent(DEVICE, { cardUid: EVENTID_CARD, event: "CARD_DETECTED", eventId });
    const retry = await ingestNfcEvent(DEVICE, { cardUid: EVENTID_CARD, event: "CARD_DETECTED", eventId });

    expect(first.eventId).toBe(eventId);
    expect(retry.eventId).toBe(eventId);
    expect(retry.duplicate).toBe(true);
  });

  it("reports a revoked card without identifying the student", async () => {
    const { ingestNfcEvent } = await import("@/server/services/nfc");
    const result = await ingestNfcEvent(DEVICE, { cardUid: REVOKED_CARD, event: "CARD_DETECTED", eventId: uid("evt") });

    expect(result.identification.identified).toBe(false);
    expect(result.identification.reason).toBe("CARD_REVOKED");
    expect(result.identification.student).toBeNull();
    expect(result.identification.messageEn).toBeTruthy();
    expect(result.identification.messageAr).toBeTruthy();
  });

  it("reports an unknown card as CARD_UNKNOWN", async () => {
    const { ingestNfcEvent } = await import("@/server/services/nfc");
    const result = await ingestNfcEvent(DEVICE, { cardUid: "04DEADBEEF01", event: "CARD_DETECTED", eventId: uid("evt") });

    expect(result.identification.identified).toBe(false);
    expect(result.identification.reason).toBe("CARD_UNKNOWN");
  });

  it("records scan lifecycle events without an identification", async () => {
    const { ingestNfcEvent } = await import("@/server/services/nfc");
    const started = await ingestNfcEvent(DEVICE, { cardUid: CARD, event: "SCAN_STARTED", eventId: uid("evt") });
    expect(started.duplicate).toBe(false);
    expect(started.identification.identified).toBe(false);
    expect(started.identification.reason).toBeNull();

    const failed = await ingestNfcEvent(DEVICE, { cardUid: CARD, event: "SCAN_FAILED", eventId: uid("evt") });
    expect(failed.identification.reason).toBe("CARD_UNKNOWN");
  });

  it("stores events as simulated and records a dedupe key per scan", async () => {
    const { deviceEvents } = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");

    const events = await db.select().from(deviceEvents).where(eq(deviceEvents.deviceId, DEVICE.deviceId));
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.simulated === true)).toBe(true);
    expect(events.some((event) => event.type === "NFC_SCAN_RECEIVED" && event.dedupeKey)).toBe(true);
  });
});

describe("NFC validation", () => {
  it("rejects malformed card UIDs before they reach the database", async () => {
    const { nfcEventSchema } = await import("@/lib/validation/nfc");
    expect(nfcEventSchema.safeParse({ cardUid: "ab" }).success).toBe(false);
    expect(nfcEventSchema.safeParse({ cardUid: "has spaces here" }).success).toBe(false);
    expect(nfcEventSchema.safeParse({ cardUid: "04A1B2C3D4E5F6" }).success).toBe(true);
    expect(nfcEventSchema.safeParse({ cardUid: "04:A1:B2:C3" }).success).toBe(true);
  });

  it("defaults a missing event type to CARD_DETECTED", async () => {
    const { nfcEventSchema } = await import("@/lib/validation/nfc");
    const parsed = nfcEventSchema.parse({ cardUid: "04A1B2C3D4E5F6" });
    expect(parsed.event).toBe("CARD_DETECTED");
  });
});
