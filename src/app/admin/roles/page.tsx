import type { Metadata } from "next";
import { RolesManager } from "@/components/admin/roles-manager";
import { requireUserPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Roles & permissions" };

/** Role → permission matrix editor (SUPER_ADMIN is always full and read-only). */
export default async function RolesPage() {
  await requireUserPage("roles.manage", "/admin/roles");
  return <RolesManager />;
}
