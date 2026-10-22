import type { Metadata } from "next";
import { FacultiesManager } from "@/components/admin/faculties-manager";
import { requireUserPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Faculties" };

export default async function FacultiesPage() {
  await requireUserPage("academics.manage", "/admin/faculties");
  return <FacultiesManager />;
}
