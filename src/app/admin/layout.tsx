import type { Metadata } from "next";
import { requireUserPage } from "@/server/auth/guard";
import { AdminShell } from "@/components/admin/shell";

export const metadata: Metadata = { title: "Admin" };

/**
 * Server-side gate for the entire admin area: no session → redirected to /login.
 * Individual pages additionally require their own permission server-side.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage(undefined, "/admin");

  return (
    <AdminShell
      user={{
        name: user.name,
        email: user.email,
        roles: user.roles,
        permissions: [...user.permissions],
      }}
    >
      {children}
    </AdminShell>
  );
}
