import type { Metadata } from "next";
import { CommandsManager } from "@/components/admin/commands-manager";
import { requireUserPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Commands" };

/** Command queue: issue, cancel, watch expiry and trigger the emergency stop. */
export default async function CommandsPage() {
  await requireUserPage("devices.read", "/admin/commands");
  return <CommandsManager />;
}
