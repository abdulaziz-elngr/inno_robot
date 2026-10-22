import { desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { ApiError } from "@/server/auth/guard";
import { assertPasswordStrength, hashPassword } from "@/server/auth/password";
import { revokeAllSessions } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { permissions, rolePermissions, roles, userRoles, users } from "@/server/db/schema";
import type { RoleKey } from "@/server/db/schema/common";
import { ROLES } from "@/server/db/schema/common";
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import type { AdminUserInput, RoleUpsertInput, UpdateAdminUserInput, paginationSchema } from "@/lib/validation/admin";
import type { z } from "zod";
import { audit } from "./audit";

type UserQuery = z.infer<typeof paginationSchema>;

export async function listUsers(query: UserQuery) {
  const { page, pageSize, q } = query;
  const where = q ? ilike(users.email, `%${q}%`) : undefined;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      active: users.active,
      locale: users.locale,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      roleKeys: sql<string[]>`coalesce(array_agg(${roles.key} order by ${roles.key}) filter (where ${roles.key} is not null), '{}')`,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .where(where)
    .groupBy(users.id)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const totalRow = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(where);
  return { rows, total: totalRow[0]?.count ?? 0, page, pageSize };
}

export async function getUser(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  const assigned = await db
    .select({ key: roles.key })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, id));
  const { passwordHash: _passwordHash, ...safe } = user;
  return { user: safe, roles: assigned.map((r) => r.key as RoleKey) };
}

async function roleIdsFor(keys: RoleKey[]): Promise<string[]> {
  const rows = await db.select({ id: roles.id, key: roles.key }).from(roles).where(inArray(roles.key, keys));
  if (rows.length !== keys.length) throw new ApiError(400, "Unknown role in assignment.", "ROLE_UNKNOWN");
  return rows.map((r) => r.id);
}

async function syncRoles(userId: string, keys: RoleKey[]) {
  const roleIds = await roleIdsFor(keys);
  await db.delete(userRoles).where(eq(userRoles.userId, userId));
  if (roleIds.length) {
    await db.insert(userRoles).values(roleIds.map((roleId) => ({ userId, roleId })));
  }
}

export async function createUser(input: AdminUserInput, actorId: string) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (existing) throw new ApiError(409, "An administrator with this email already exists.", "USER_EXISTS");
  const strengthError = assertPasswordStrength(input.password);
  if (strengthError) throw new ApiError(400, strengthError, "PASSWORD_TOO_WEAK");

  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id,
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      active: input.active,
    });
    const roleIds = await roleIdsFor(input.roles);
    if (roleIds.length) await tx.insert(userRoles).values(roleIds.map((roleId) => ({ userId: id, roleId, assignedBy: actorId })));
  });
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "user.created", targetType: "user", targetId: id, metadata: { email: input.email, roles: input.roles } });
  return id;
}

export async function updateUser(id: string, input: UpdateAdminUserInput, actorId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw new ApiError(404, "User not found.", "USER_NOT_FOUND");

  const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.active !== undefined) patch.active = input.active;
  if (input.newPassword) {
    const strengthError = assertPasswordStrength(input.newPassword);
    if (strengthError) throw new ApiError(400, strengthError, "PASSWORD_TOO_WEAK");
    patch.passwordHash = await hashPassword(input.newPassword);
    patch.mustChangePassword = false;
  }

  await db.update(users).set(patch).where(eq(users.id, id));
  if (input.roles) await syncRoles(id, input.roles);

  // Privilege hygiene: deactivation or password reset kills existing sessions immediately.
  if (input.active === false || input.newPassword) await revokeAllSessions(id);

  await audit({
    actorUserId: actorId,
    actorLabel: "admin",
    action: "user.updated",
    targetType: "user",
    targetId: id,
    metadata: { fields: Object.keys(input), roles: input.roles, active: input.active },
  });
}

/* ── Roles & permissions ────────────────────────────────────────────────────── */

export async function listRolesWithPermissions() {
  const allPermissions = await db.select().from(permissions).orderBy(permissions.key);
  const allRoles = await db.select().from(roles).orderBy(roles.createdAt);
  const assignments = await db.select().from(rolePermissions);
  return allRoles.map((role) => ({
    ...role,
    permissions: assignments.filter((a) => a.roleId === role.id).map((a) => a.permissionId),
    permissionKeys: allPermissions
      .filter((p) => assignments.some((a) => a.roleId === role.id && a.permissionId === p.id))
      .map((p) => p.key as PermissionKey),
    isSuperAdmin: role.key === "SUPER_ADMIN",
  }));
}

export async function listPermissions() {
  return db.select().from(permissions).orderBy(permissions.key);
}

/**
 * Edits a role's permission set. The SUPER_ADMIN role always keeps the full catalogue and
 * cannot be reduced — this prevents an administrator from editing their own escalation path.
 */
export async function upsertRole(input: RoleUpsertInput, actorId: string) {
  if (input.key === "SUPER_ADMIN" && !input.permissions.includes("*")) {
    // force full permissions for SUPER_ADMIN regardless of submitted payload
    input = { ...input, permissions: ALL_PERMISSIONS };
  }
  const [existing] = await db.select().from(roles).where(eq(roles.key, input.key)).limit(1);

  const permissionRows = await db.select({ id: permissions.id, key: permissions.key }).from(permissions);
  const wanted = new Set(input.permissions);
  const validIds = permissionRows.filter((p) => wanted.has(p.key)).map((p) => p.id);

  let roleId = existing?.id;
  await db.transaction(async (tx) => {
    if (!roleId) {
      roleId = crypto.randomUUID();
      await tx.insert(roles).values({ id: roleId, key: input.key, nameEn: input.nameEn, nameAr: input.nameAr, description: input.description || null, system: true });
    } else {
      await tx.update(roles).set({ nameEn: input.nameEn, nameAr: input.nameAr, description: input.description || null }).where(eq(roles.id, roleId));
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    }
    if (validIds.length && roleId) {
      await tx.insert(rolePermissions).values(validIds.map((permissionId) => ({ roleId: roleId as string, permissionId })));
    }
  });

  await audit({ actorUserId: actorId, actorLabel: "admin", action: "role.updated", targetType: "role", targetId: roleId, metadata: { key: input.key, permissionCount: validIds.length } });
  return roleId;
}

/** Idempotent bootstrap of roles, permissions and their mappings (used by the seed script). */
export async function ensureSystemRoles(): Promise<void> {
  const existingPermissions = await db.select().from(permissions);
  const byKey = new Map(existingPermissions.map((p) => [p.key, p.id]));
  for (const key of ALL_PERMISSIONS) {
    if (byKey.has(key)) continue;
    const id = crypto.randomUUID();
    await db.insert(permissions).values({ id, key, descriptionEn: key, descriptionAr: key });
    byKey.set(key, id);
  }

  for (const key of ROLES) {
    const [role] = await db.select().from(roles).where(eq(roles.key, key)).limit(1);
    const roleId = role?.id ?? crypto.randomUUID();
    if (!role) {
      await db.insert(roles).values({
        id: roleId,
        key,
        nameEn: key.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
        nameAr: key,
        system: true,
        description: `System role ${key}`,
      });
    }
    const wanted = new Set<PermissionKey>(DEFAULT_ROLE_PERMISSIONS[key]);
    const assigned = await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    const assignedIds = new Set(assigned.map((a) => a.permissionId));
    for (const [permKey, permId] of byKey) {
      if (wanted.has(permKey as PermissionKey) && !assignedIds.has(permId)) {
        await db.insert(rolePermissions).values({ roleId, permissionId: permId }).onConflictDoNothing();
      }
    }
  }
}

export const SYSTEM_ROLE_KEYS: RoleKey[] = [...ROLES];
