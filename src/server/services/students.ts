import { createHmac } from "node:crypto";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, type Executor } from "@/server/db/client";
import { departments, faculties, studentCards, students } from "@/server/db/schema";
import type { CardStatus, StudentStatus } from "@/server/db/schema/common";
import { ApiError } from "@/server/auth/guard";
import type { AssociateCardInput, RevokeCardInput } from "@/lib/validation/nfc";
import type { StudentInput, studentQuerySchema } from "@/lib/validation/admin";
import type { z } from "zod";
import { audit } from "./audit";

type StudentQuery = z.infer<typeof studentQuerySchema>;

/**
 * Card UIDs are identifiers, not secrets — but we still store only a keyed hash
 * (HMAC under a server-side key) plus the last 4 characters for support matching.
 */
export function hashCardUid(uid: string): string {
  const key = createHmac("sha256", process.env.AUTH_SECRET ?? "inno-robot-card-uid-local-only")
    .update("card-uid")
    .digest();
  return createHmac("sha256", key).update(normalizeUid(uid)).digest("hex");
}

export function normalizeUid(uid: string): string {
  return uid.trim().toUpperCase();
}

export function uidLast4(uid: string): string {
  const n = normalizeUid(uid);
  return n.slice(-4);
}

export type StudentRecord = typeof students.$inferSelect;
export type CardRecord = typeof studentCards.$inferSelect;

export async function listStudents(query: StudentQuery) {
  const { page, pageSize, q, status, facultyId } = query;
  const filters = [];
  if (q) {
    const like = `%${q}%`;
    const search = or(
      ilike(students.nameEn, like),
      ilike(students.nameAr, like),
      ilike(students.universityId, like),
    );
    if (search) filters.push(search);
  }
  if (status) filters.push(eq(students.status, status));
  if (facultyId) filters.push(eq(students.facultyId, facultyId));
  const where = filters.length ? and(...filters) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: students.id,
        universityId: students.universityId,
        nameEn: students.nameEn,
        nameAr: students.nameAr,
        firstNameEn: students.firstNameEn,
        firstNameAr: students.firstNameAr,
        email: students.email,
        status: students.status,
        facultyId: students.facultyId,
        departmentId: students.departmentId,
        facultyNameEn: faculties.nameEn,
        createdAt: students.createdAt,
        cardCount: sql<number>`(select count(*)::int from student_cards c where c.student_id = ${students.id})`,
      })
      .from(students)
      .leftJoin(faculties, eq(students.facultyId, faculties.id))
      .where(where)
      .orderBy(desc(students.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(students).where(where),
  ]);

  return { rows, total: totalRow[0]?.count ?? 0, page, pageSize };
}

export async function getStudent(id: string) {
  const [row] = await db
    .select()
    .from(students)
    .where(eq(students.id, id))
    .limit(1);
  if (!row) throw new ApiError(404, "Student not found.", "STUDENT_NOT_FOUND");
  const cards = await db.select().from(studentCards).where(eq(studentCards.studentId, id));
  return { student: row, cards };
}

export async function createStudent(input: StudentInput, actorId: string) {
  const existing = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.universityId, input.universityId))
    .limit(1);
  if (existing.length) throw new ApiError(409, "A student with this university ID already exists.", "STUDENT_EXISTS");

  await assertFacultyDepartment(input);

  const id = crypto.randomUUID();
  await db.insert(students).values({
    id,
    universityId: input.universityId,
    nameEn: input.nameEn,
    nameAr: input.nameAr,
    firstNameEn: input.firstNameEn,
    firstNameAr: input.firstNameAr,
    email: input.email || null,
    facultyId: input.facultyId || null,
    departmentId: input.departmentId || null,
    status: input.status,
  });
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "student.created", targetType: "student", targetId: id });
  return id;
}

export async function updateStudent(id: string, input: StudentInput, actorId: string) {
  await getStudent(id);
  await assertFacultyDepartment(input);
  await db
    .update(students)
    .set({
      universityId: input.universityId,
      nameEn: input.nameEn,
      nameAr: input.nameAr,
      firstNameEn: input.firstNameEn,
      firstNameAr: input.firstNameAr,
      email: input.email || null,
      facultyId: input.facultyId || null,
      departmentId: input.departmentId || null,
      status: input.status,
      updatedAt: new Date(),
    })
    .where(eq(students.id, id));
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "student.updated", targetType: "student", targetId: id });
}

/** Students are archived rather than deleted so historical records stay consistent. */
export async function archiveStudent(id: string, actorId: string) {
  await db.update(students).set({ status: "ARCHIVED" satisfies StudentStatus, updatedAt: new Date() }).where(eq(students.id, id));
  // Revoking cards prevents an archived student from being identified at a terminal.
  await db.update(studentCards).set({ status: "REVOKED", revokedAt: new Date(), revokedReason: "Student archived" }).where(eq(studentCards.studentId, id));
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "student.archived", targetType: "student", targetId: id });
}

/** Rejects impossible faculty/department combinations before they reach the database. */
async function assertFacultyDepartment(input: StudentInput) {
  if (input.departmentId) {
    const [dept] = await db.select().from(departments).where(eq(departments.id, input.departmentId)).limit(1);
    if (!dept) throw new ApiError(400, "Selected department does not exist.", "DEPARTMENT_INVALID");
    if (input.facultyId && dept.facultyId !== input.facultyId) {
      throw new ApiError(400, "Department does not belong to the selected faculty.", "DEPARTMENT_FACULTY_MISMATCH");
    }
  }
}

/** Resolves an active card + active student for a raw card UID. Returns null when unknown. */
export async function resolveCardUid(uid: string, exec: Executor = db) {
  const uidHash = hashCardUid(uid);
  const [row] = await exec
    .select({
      card: studentCards,
      student: students,
      facultyCode: faculties.code,
      facultyId: faculties.id,
    })
    .from(studentCards)
    .innerJoin(students, eq(studentCards.studentId, students.id))
    .leftJoin(faculties, eq(students.facultyId, faculties.id))
    .where(eq(studentCards.uidHash, uidHash))
    .limit(1);
  if (!row) return null;
  return row;
}

export type CardResolution = NonNullable<Awaited<ReturnType<typeof resolveCardUid>>>;

/** Associates a physical card with a student (or reactivates a revoked one for the same student). */
export async function associateCard(input: AssociateCardInput, actorId: string): Promise<CardRecord> {
  const uidHash = hashCardUid(input.cardUid);
  const [student] = await db.select().from(students).where(eq(students.id, input.studentId)).limit(1);
  if (!student) throw new ApiError(404, "Student not found.", "STUDENT_NOT_FOUND");
  if (student.status !== "ACTIVE") throw new ApiError(400, "Cards can only be associated with active students.", "STUDENT_INACTIVE");

  const [existing] = await db.select().from(studentCards).where(eq(studentCards.uidHash, uidHash)).limit(1);
  if (existing) {
    if (existing.studentId === input.studentId && existing.status !== "REVOKED") {
      throw new ApiError(409, "This card is already associated with the student.", "CARD_ALREADY_ASSOCIATED");
    }
    if (existing.status === "ACTIVE") {
      throw new ApiError(409, "This card is already associated with another student.", "CARD_IN_USE");
    }
    // Revoked/lost/expired card re-issued to its (or another) student.
    await db
      .update(studentCards)
      .set({ studentId: input.studentId, status: "ACTIVE", revokedAt: null, revokedReason: null, label: input.label ?? null, updatedAt: new Date() })
      .where(eq(studentCards.id, existing.id));
    await audit({ actorUserId: actorId, actorLabel: "admin", action: "card.reactivated", targetType: "card", targetId: existing.id, metadata: { studentId: input.studentId } });
    const [updated] = await db.select().from(studentCards).where(eq(studentCards.id, existing.id)).limit(1);
    if (!updated) throw new ApiError(500, "Card update failed.", "CARD_UPDATE_FAILED");
    return updated;
  }

  const id = crypto.randomUUID();
  await db.insert(studentCards).values({
    id,
    studentId: input.studentId,
    uidHash,
    uidLast4: uidLast4(input.cardUid),
    label: input.label ?? null,
    status: "ACTIVE",
  });
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "card.associated", targetType: "card", targetId: id, metadata: { studentId: input.studentId, uidLast4: uidLast4(input.cardUid) } });
  const [created] = await db.select().from(studentCards).where(eq(studentCards.id, id)).limit(1);
  if (!created) throw new ApiError(500, "Card creation failed.", "CARD_CREATE_FAILED");
  return created;
}

/** Revokes a lost/stolen card immediately. Revocation is honoured at identification time. */
export async function revokeCard(input: RevokeCardInput, actorId: string) {
  const [card] = await db.select().from(studentCards).where(eq(studentCards.id, input.cardId)).limit(1);
  if (!card) throw new ApiError(404, "Card not found.", "CARD_NOT_FOUND");
  await db
    .update(studentCards)
    .set({ status: "REVOKED" satisfies CardStatus, revokedAt: new Date(), revokedReason: input.reason, updatedAt: new Date() })
    .where(eq(studentCards.id, input.cardId));
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "card.revoked", targetType: "card", targetId: input.cardId, metadata: { reason: input.reason } });
}

export async function listCards(query: { page: number; pageSize: number; q?: string; status?: CardStatus }) {
  const filters = [];
  if (query.status) filters.push(eq(studentCards.status, query.status));
  if (query.q) {
    const like = `%${query.q}%`;
    const search = or(ilike(students.nameEn, like), ilike(students.nameAr, like), ilike(studentCards.label, like), ilike(studentCards.uidLast4, like));
    if (search) filters.push(search);
  }
  const where = filters.length ? and(...filters) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: studentCards.id,
        uidLast4: studentCards.uidLast4,
        label: studentCards.label,
        status: studentCards.status,
        issuedAt: studentCards.issuedAt,
        revokedAt: studentCards.revokedAt,
        revokedReason: studentCards.revokedReason,
        lastSeenAt: studentCards.lastSeenAt,
        studentId: students.id,
        studentNameEn: students.nameEn,
        studentNameAr: students.nameAr,
        studentStatus: students.status,
      })
      .from(studentCards)
      .innerJoin(students, eq(studentCards.studentId, students.id))
      .where(where)
      .orderBy(desc(studentCards.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(studentCards)
      .innerJoin(students, eq(studentCards.studentId, students.id))
      .where(where),
  ]);
  return { rows, total: totalRow[0]?.count ?? 0, page: query.page, pageSize: query.pageSize };
}

export async function setCardStatus(cardId: string, status: CardStatus, actorId: string, reason?: string) {
  await db
    .update(studentCards)
    .set({ status, updatedAt: new Date(), revokedAt: status === "ACTIVE" ? null : new Date(), revokedReason: status === "ACTIVE" ? null : (reason ?? null) })
    .where(eq(studentCards.id, cardId));
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "card.status_changed", targetType: "card", targetId: cardId, metadata: { status, reason } });
}


