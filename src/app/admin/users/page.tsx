import type { Metadata } from "next";
import { UsersManager } from "@/components/admin/users-manager";
import { requireUserPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administrators" };

/** Console account management (server-side permission gate; the API re-checks). */
export default async function UsersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireUserPage("users.manage", "/admin/users");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  return <UsersManager initialPage={page} />;
}
