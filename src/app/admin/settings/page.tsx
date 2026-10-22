import type { Metadata } from "next";
import { SettingsManager } from "@/components/admin/settings-manager";
import { requireUserPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

/** Application-wide settings (never contains secrets — those live in the environment). */
export default async function SettingsPage() {
  await requireUserPage("settings.manage", "/admin/settings");
  return <SettingsManager />;
}
