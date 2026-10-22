import type { Metadata } from "next";
import { DepartmentsManager } from "@/components/admin/departments-manager";
import { requireUserPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  await requireUserPage("academics.manage", "/admin/departments");
  return <DepartmentsManager />;
}
