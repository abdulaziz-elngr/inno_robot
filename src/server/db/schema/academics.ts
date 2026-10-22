import { boolean, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { CARD_STATUSES, STUDENT_STATUSES} from "./common";
import { createdAtCol, idCol, updatedAtCol } from "./common";

export const faculties = pgTable(
  "faculties",
  {
    id: idCol(),
    code: text("code").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [uniqueIndex("faculties_code_unique").on(t.code)],
);

export const departments = pgTable(
  "departments",
  {
    id: idCol(),
    facultyId: text("faculty_id")
      .notNull()
      .references(() => faculties.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [uniqueIndex("departments_code_unique").on(t.code), index("departments_faculty_idx").on(t.facultyId)],
);

export const students = pgTable(
  "students",
  {
    id: idCol(),
    universityId: text("university_id").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    /** Only what the assistant actually needs for a greeting; never used as a credential. */
    firstNameEn: text("first_name_en").notNull(),
    firstNameAr: text("first_name_ar").notNull(),
    email: text("email"),
    facultyId: text("faculty_id").references(() => faculties.id, { onDelete: "set null" }),
    departmentId: text("department_id").references(() => departments.id, { onDelete: "set null" }),
    status: text("status").$type<(typeof STUDENT_STATUSES)[number]>().notNull().default("ACTIVE"),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [
    uniqueIndex("students_university_id_unique").on(t.universityId),
    index("students_status_idx").on(t.status),
    index("students_faculty_idx").on(t.facultyId),
    index("students_department_idx").on(t.departmentId),
  ],
);

/**
 * NFC student cards.
 * `uid_hash` stores a keyed hash of the card UID (identifiers are never treated as
 * secrets and raw UIDs are not kept), `uid_last4` exists purely so staff can match a
 * physical card during support without exposing the full identifier.
 */
export const studentCards = pgTable(
  "student_cards",
  {
    id: idCol(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    uidHash: text("uid_hash").notNull(),
    uidLast4: text("uid_last4").notNull(),
    label: text("label"),
    status: text("status").$type<(typeof CARD_STATUSES)[number]>().notNull().default("ACTIVE"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [
    uniqueIndex("student_cards_uid_hash_unique").on(t.uidHash),
    index("student_cards_student_idx").on(t.studentId),
    index("student_cards_status_idx").on(t.status),
  ],
);
