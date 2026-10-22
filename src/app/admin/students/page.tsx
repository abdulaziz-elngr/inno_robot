import type { Metadata } from "next";
import { StudentsManager } from "@/components/admin/students-manager";
import { requireUserPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Students" };

/** Student records (server-side permission gate; the API re-checks every action). */
export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireUserPage("students.read", "/admin/students");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  return <StudentsManager initialPage={page} />;
}
