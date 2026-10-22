import type { Metadata } from "next";
import { NavigationManager } from "@/components/admin/navigation-manager";
import { requireUserPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Navigation" };

/** Navigation destinations + predefined routes the robot follows. */
export default async function NavigationPage() {
  await requireUserPage("navigation.manage", "/admin/navigation");
  return <NavigationManager />;
}
