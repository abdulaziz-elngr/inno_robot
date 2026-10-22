import type { RoleKey } from "@/server/db/schema/common";

/** Central permission catalogue. Keys are stored in the `permissions` table and assigned per role. */
export const PERMISSIONS = {
  studentsRead: "students.read",
  studentsWrite: "students.write",
  cardsManage: "cards.manage",
  academicsManage: "academics.manage",
  locationsManage: "locations.manage",
  knowledgeManage: "knowledge.manage",
  navigationManage: "navigation.manage",
  devicesRead: "devices.read",
  devicesManage: "devices.manage",
  commandsIssue: "commands.issue",
  commandsStop: "commands.stop",
  conversationsRead: "conversations.read",
  analyticsRead: "analytics.read",
  mediaManage: "media.manage",
  usersManage: "users.manage",
  rolesManage: "roles.manage",
  settingsManage: "settings.manage",
  securityRead: "security.read",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as PermissionKey[];

const READ_ONLY: PermissionKey[] = [
  PERMISSIONS.studentsRead,
  PERMISSIONS.devicesRead,
  PERMISSIONS.analyticsRead,
  PERMISSIONS.conversationsRead,
];

/**
 * Default role → permission mapping used by the seed script.
 * Roles remain editable in the database afterwards; this is the bootstrap baseline.
 * Only SUPER_ADMIN receives `roles.manage`, which prevents privilege escalation by admins.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS.filter((p) => p !== PERMISSIONS.rolesManage),
  UNIVERSITY_STAFF: [
    PERMISSIONS.studentsRead,
    PERMISSIONS.studentsWrite,
    PERMISSIONS.cardsManage,
    PERMISSIONS.academicsManage,
    PERMISSIONS.knowledgeManage,
    PERMISSIONS.conversationsRead,
    PERMISSIONS.analyticsRead,
    PERMISSIONS.mediaManage,
  ],
  ROBOT_OPERATOR: [
    PERMISSIONS.devicesRead,
    PERMISSIONS.commandsIssue,
    PERMISSIONS.commandsStop,
    PERMISSIONS.analyticsRead,
  ],
  CONTENT_MANAGER: [
    PERMISSIONS.knowledgeManage,
    PERMISSIONS.locationsManage,
    PERMISSIONS.navigationManage,
    PERMISSIONS.mediaManage,
    PERMISSIONS.analyticsRead,
  ],
  VIEWER: READ_ONLY,
};

/** Higher-value roles are listed first in the UI. */
export const ROLE_ORDER: RoleKey[] = ["SUPER_ADMIN", "ADMIN", "UNIVERSITY_STAFF", "ROBOT_OPERATOR", "CONTENT_MANAGER", "VIEWER"];
