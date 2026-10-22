import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestDb, initTestDb, uid } from "./helpers/db";

/**
 * NFC card lifecycle: association, revocation, re-issue and the resolution the
 * terminal relies on. Card UIDs are stored as an HMAC hash + last 4 only.
 */

describe("card association and revocation", () => {
  const actorId = uid("actor");
  let studentId: string;
  let secondStudentId: string;

  const CARD = "04A1B2C3D4E5F6";
  const OTHER_CARD = "04A1B2C3D4E5F7";

  beforeAll(async () => {
    await initTestDb();
    const { createStudent } = await import("@/server/services/students");
    studentId = await createStudent(
      { universityId: uid("STU"), nameEn: "Test Student", nameAr: "طالب تجريبي", firstNameEn: "Test", firstNameAr: "تجريبي", email: "", facultyId: null, departmentId: null, status: "ACTIVE" },
      actorId,
    );
    secondStudentId = await createStudent(
      { universityId: uid("STU"), nameEn: "Second Student", nameAr: "طالب ثانٍ", firstNameEn: "Second", firstNameAr: "ثاني", email: "", facultyId: null, departmentId: null, status: "ACTIVE" },
      actorId,
    );
  });

  afterAll(cleanupTestDb);

  it("associates an active card and resolves the student by UID", async () => {
    const { associateCard, resolveCardUid } = await import("@/server/services/students");
    const card = await associateCard({ studentId, cardUid: CARD }, actorId);

    expect(card.status).toBe("ACTIVE");
    expect(card.uidLast4).toBe("E5F6");
    // The raw UID must never be stored.
    expect(card.uidHash).not.toContain(CARD);

    const resolution = await resolveCardUid(CARD);
    expect(resolution?.student.id).toBe(studentId);
    // Case-insensitive lookup (readers emit mixed case).
    expect((await resolveCardUid("04a1b2c3d4e5f6"))?.student.id).toBe(studentId);
  });

  it("rejects associating the same card to the same student twice", async () => {
    const { associateCard } = await import("@/server/services/students");
    await expect(associateCard({ studentId, cardUid: CARD }, actorId)).rejects.toMatchObject({ code: "CARD_ALREADY_ASSOCIATED" });
  });

  it("rejects stealing an active card from another student", async () => {
    const { associateCard } = await import("@/server/services/students");
    await expect(associateCard({ studentId: secondStudentId, cardUid: CARD }, actorId)).rejects.toMatchObject({ code: "CARD_IN_USE" });
  });

  it("revocation stops identification immediately and keeps an audit trail", async () => {
    const { associateCard, getStudent, revokeCard } = await import("@/server/services/students");
    const card = await associateCard({ studentId, cardUid: OTHER_CARD, label: "reissued" }, actorId);

    await revokeCard({ cardId: card.id, reason: "lost" }, actorId);

    const { cards } = await getStudent(studentId);
    const revoked = cards.find((c) => c.id === card.id);
    expect(revoked?.status).toBe("REVOKED");
    expect(revoked?.revokedAt).not.toBeNull();
    expect(revoked?.revokedReason).toBe("lost");
  });

  it("a revoked card still resolves but is flagged REVOKED (never silently unknown)", async () => {
    // resolveCardUid returns the row so the caller can distinguish "revoked" from
    // "unknown card"; the NFC ingestion layer is what refuses identification.
    const { resolveCardUid } = await import("@/server/services/students");
    const resolution = await resolveCardUid(OTHER_CARD);
    expect(resolution?.card.status).toBe("REVOKED");
    expect(resolution?.card.revokedReason).toBe("lost");
    // An unknown UID, by contrast, resolves to null.
    expect(await resolveCardUid("04DEADBEEF99")).toBeNull();
  });

  it("re-issuing a revoked card reactivates it for the same student", async () => {
    const { associateCard, getStudent, revokeCard } = await import("@/server/services/students");
    const REISSUED = "04A1B2C3D4E5F8";
    const card = await associateCard({ studentId, cardUid: REISSUED }, actorId);
    await revokeCard({ cardId: card.id, reason: "damaged" }, actorId);

    const again = await associateCard({ studentId, cardUid: REISSUED, label: "replacement" }, actorId);
    expect(again.id).toBe(card.id); // same row, not a duplicate
    expect(again.status).toBe("ACTIVE");
    expect(again.revokedAt).toBeNull();

    const { cards } = await getStudent(studentId);
    expect(cards.filter((c) => c.uidLast4 === "E5F8")).toHaveLength(1);
  });

  it("refuses to attach cards to a non-active student", async () => {
    const { associateCard, createStudent } = await import("@/server/services/students");
    const archivedId = await createStudent(
      { universityId: uid("STU"), nameEn: "Archived", nameAr: "مؤرشف", firstNameEn: "Arch", firstNameAr: "مؤ", email: "", facultyId: null, departmentId: null, status: "ARCHIVED" },
      actorId,
    );

    await expect(associateCard({ studentId: archivedId, cardUid: "04A1B2C3D4E5F9" }, actorId)).rejects.toMatchObject({ code: "STUDENT_INACTIVE" });
  });

  it("listCards can filter by status and search by last 4", async () => {
    const { listCards } = await import("@/server/services/students");
    const active = await listCards({ page: 1, pageSize: 50, status: "ACTIVE" });
    expect(active.rows.every((row) => row.status === "ACTIVE")).toBe(true);

    const byLast4 = await listCards({ page: 1, pageSize: 50, q: "E5F6" });
    expect(byLast4.rows.some((row) => row.uidLast4 === "E5F6")).toBe(true);
  });
});
