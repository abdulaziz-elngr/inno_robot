import { randomUUID } from "node:crypto";
import { asc, eq, ilike, sql } from "drizzle-orm";
import { ApiError } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { departments, faculties } from "@/server/db/schema";
import type { FacultyInput } from "@/lib/validation/admin";
import { audit } from "./audit";

/** Faculties + departments (academic structure). Soft-active only — never hard-deleted (students reference them). */

export async function listFaculties(opts?: { activeOnly?: boolean }) {
  const where = opts?.activeOnly ? eq(faculties.active, true) : undefined;
  const rows = await db
    .select({
      id: faculties.id,
      code: faculties.code,
      nameEn: faculties.nameEn,
      nameAr: faculties.nameAr,
      active: faculties.active,
      departmentCount: sql<number>`(select count(*)::int from ${departments} where ${departments.facultyId} = ${faculties.id} and ${departments.active} = true)`,
    })
    .from(faculties)
    .where(where)
    .orderBy(asc(faculties.code));
  return rows;
}

export async function createFaculty(input: FacultyInput, actorId: string) {
  const existing = await db.select({ id: faculties.id }).from(faculties).where(eq(faculties.code, input.code)).limit(1);
  if (existing.length) throw new ApiError(409, "A faculty with this code already exists.", "FACULTY_EXISTS");
  const id = randomUUID();
  await db.insert(faculties).values({ id, code: input.code, nameEn: input.nameEn, nameAr: input.nameAr, active: input.active });
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "faculty.created", targetType: "faculty", targetId: id, metadata: { code: input.code } });
  return { id };
}

export async function updateFaculty(id: string, input: Partial<FacultyInput>, actorId: string) {
  const [existing] = await db.select({ id: faculties.id }).from(faculties).where(eq(faculties.id, id)).limit(1);
  if (!existing) throw new ApiError(404, "Faculty not found.", "FACULTY_NOT_FOUND");
  if (input.code) {
    const clash = await db.select({ id: faculties.id }).from(faculties).where(eq(faculties.code, input.code)).limit(1);
    if (clash.length && clash[0]?.id !== id) throw new ApiError(409, "A faculty with this code already exists.", "FACULTY_EXISTS");
  }
  await db.update(faculties).set({ ...input, updatedAt: new Date() }).where(eq(faculties.id, id));
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "faculty.updated", targetType: "faculty", targetId: id, metadata: { fields: Object.keys(input) } });
}

export async function listDepartments(facultyId?: string, opts?: { activeOnly?: boolean; q?: string }) {
  const filters = [];
  if (facultyId) filters.push(eq(departments.facultyId, facultyId));
  if (opts?.activeOnly) filters.push(eq(departments.active, true));
  if (opts?.q) filters.push(ilike(departments.nameEn, `%${opts.q}%`));
  const where = filters.length ? sql`${sql.join(filters, sql` and `)}` : undefined;
  return db
    .select({
      id: departments.id,
      facultyId: departments.facultyId,
      code: departments.code,
      nameEn: departments.nameEn,
      nameAr: departments.nameAr,
      active: departments.active,
      facultyNameEn: faculties.nameEn,
      facultyNameAr: faculties.nameAr,
    })
    .from(departments)
    .innerJoin(faculties, eq(departments.facultyId, faculties.id))
    .where(where)
    .orderBy(asc(departments.code));
}

export async function createDepartment(input: { facultyId: string; code: string; nameEn: string; nameAr: string; active: boolean }, actorId: string) {
  const [faculty] = await db.select({ id: faculties.id }).from(faculties).where(eq(faculties.id, input.facultyId)).limit(1);
  if (!faculty) throw new ApiError(400, "Selected faculty does not exist.", "FACULTY_INVALID");
  const existing = await db.select({ id: departments.id }).from(departments).where(eq(departments.code, input.code)).limit(1);
  if (existing.length) throw new ApiError(409, "A department with this code already exists.", "DEPARTMENT_EXISTS");
  const id = randomUUID();
  await db.insert(departments).values({ id, ...input });
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "department.created", targetType: "department", targetId: id, metadata: { code: input.code } });
  return { id };
}

export async function updateDepartment(id: string, input: Partial<{ facultyId: string; code: string; nameEn: string; nameAr: string; active: boolean }>, actorId: string) {
  const [existing] = await db.select({ id: departments.id }).from(departments).where(eq(departments.id, id)).limit(1);
  if (!existing) throw new ApiError(404, "Department not found.", "DEPARTMENT_NOT_FOUND");
  if (input.facultyId) {
    const [faculty] = await db.select({ id: faculties.id }).from(faculties).where(eq(faculties.id, input.facultyId)).limit(1);
    if (!faculty) throw new ApiError(400, "Selected faculty does not exist.", "FACULTY_INVALID");
  }
  if (input.code) {
    const clash = await db.select({ id: departments.id }).from(departments).where(eq(departments.code, input.code)).limit(1);
    if (clash.length && clash[0]?.id !== id) throw new ApiError(409, "A department with this code already exists.", "DEPARTMENT_EXISTS");
  }
  await db.update(departments).set({ ...input, updatedAt: new Date() }).where(eq(departments.id, id));
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "department.updated", targetType: "department", targetId: id, metadata: { fields: Object.keys(input) } });
}
