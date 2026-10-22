import { eq, inArray } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/server/db/client";
import { permissions, rolePermissions, roles, userRoles } from "@/server/db/schema";
import type { RoleKey } from "@/server/db/schema/common";
import { ALL_PERMISSIONS, type PermissionKey } from "@/lib/permissions";

export type Access = { roles: RoleKey[]; permissions: Set<PermissionKey> };

/**
 * Resolves a user's effective permissions from the database (roles are admin-editable).
 * SUPER_ADMIN short-circuits to the full catalogue so a seeding mistake can never lock
 * the super administrator out of their own platform.
 */
export async function loadAccess(userId: string): Promise<Access> {
  const roleRows = await db
    .select({ id: roles.id, key: roles.key })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  const roleKeys = roleRows.map((r) => r.key as RoleKey);
  if (roleKeys.includes("SUPER_ADMIN")) return { roles: roleKeys, permissions: new Set(ALL_PERMISSIONS) };
  if (roleRows.length === 0) return { roles: [], permissions: new Set() };

  const permRows = await db
    .select({ key: permissions.key })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(inArray(rolePermissions.roleId, roleRows.map((r) => r.id)));

  return { roles: roleKeys, permissions: new Set(permRows.map((p) => p.key as PermissionKey)) };
}

export function hasPermission(access: Access | null, permission: PermissionKey): boolean {
  if (!access) return false;
  if (access.roles.includes("SUPER_ADMIN")) return true;
  return access.permissions.has(permission);
}

export const loadAccessCached = cache(loadAccess);
