import type { Metadata } from "next";
import { RobotsManager } from "@/components/admin/robots-manager";
import { requireUserPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Robots" };

/** Robot device registry. */
export default async function RobotsPage() {
  await requireUserPage("devices.read", "/admin/robots");
  return <RobotsManager />;
}
