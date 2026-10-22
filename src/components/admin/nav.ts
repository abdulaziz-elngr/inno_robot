import {
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  CreditCard,
  Gamepad2,
  GraduationCap,
  Images,
  LayoutDashboard,
  Layers,
  Lock,
  MapPin,
  MessagesSquare,
  Route,
  Settings,
  ShieldCheck,
  TerminalSquare,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { PermissionKey } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions";

export type AdminNavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  /** Page-level permission required to see the link (the server enforces it on the page itself). */
  permission: PermissionKey;
  end?: boolean;
};

export type AdminNavGroup = { groupKey: string; items: AdminNavItem[] };

/** Sidebar structure. Order defines the console's information architecture. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    groupKey: "dash",
    items: [{ href: "/admin", labelKey: "admin.nav.overview", icon: LayoutDashboard, permission: PERMISSIONS.analyticsRead, end: true }],
  },
  {
    groupKey: "admin.nav.groupAcademics",
    items: [
      { href: "/admin/students", labelKey: "admin.nav.students", icon: GraduationCap, permission: PERMISSIONS.studentsRead },
      { href: "/admin/cards", labelKey: "admin.nav.cards", icon: CreditCard, permission: PERMISSIONS.studentsRead },
      { href: "/admin/faculties", labelKey: "admin.nav.faculties", icon: Building2, permission: PERMISSIONS.academicsManage },
      { href: "/admin/departments", labelKey: "admin.nav.departments", icon: Layers, permission: PERMISSIONS.academicsManage },
    ],
  },
  {
    groupKey: "admin.nav.groupCampus",
    items: [
      { href: "/admin/locations", labelKey: "admin.nav.locations", icon: MapPin, permission: PERMISSIONS.locationsManage },
      { href: "/admin/knowledge", labelKey: "admin.nav.knowledge", icon: BookOpen, permission: PERMISSIONS.knowledgeManage },
      { href: "/admin/navigation", labelKey: "admin.nav.navigation", icon: Route, permission: PERMISSIONS.navigationManage },
      { href: "/admin/media", labelKey: "admin.nav.media", icon: Images, permission: PERMISSIONS.mediaManage },
    ],
  },
  {
    groupKey: "admin.nav.groupRobots",
    items: [
      { href: "/admin/robots", labelKey: "admin.nav.robots", icon: Bot, permission: PERMISSIONS.devicesRead },
      { href: "/admin/commands", labelKey: "admin.nav.commands", icon: TerminalSquare, permission: PERMISSIONS.devicesRead },
      { href: "/control", labelKey: "admin.nav.control", icon: Gamepad2, permission: PERMISSIONS.commandsIssue },
    ],
  },
  {
    groupKey: "admin.nav.groupSystem",
    items: [
      { href: "/admin/analytics", labelKey: "admin.nav.analytics", icon: BarChart3, permission: PERMISSIONS.analyticsRead },
      { href: "/admin/conversations", labelKey: "admin.nav.conversations", icon: MessagesSquare, permission: PERMISSIONS.conversationsRead },
      { href: "/admin/users", labelKey: "admin.nav.users", icon: Users, permission: PERMISSIONS.usersManage },
      { href: "/admin/roles", labelKey: "admin.nav.roles", icon: ShieldCheck, permission: PERMISSIONS.rolesManage },
      { href: "/admin/settings", labelKey: "admin.nav.settings", icon: Settings, permission: PERMISSIONS.settingsManage },
      { href: "/admin/security", labelKey: "admin.nav.security", icon: Lock, permission: PERMISSIONS.securityRead },
    ],
  },
];
