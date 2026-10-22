import type { Metadata } from "next";
import { RobotDetail } from "@/components/admin/robot-detail";
import { requireUserPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Robot detail" };

/** Single robot: credential history, telemetry, events and command history. */
export default async function RobotDetailPage({ params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params;
  await requireUserPage("devices.read", `/admin/robots/${deviceId}`);
  return <RobotDetail deviceId={decodeURIComponent(deviceId)} />;
}
