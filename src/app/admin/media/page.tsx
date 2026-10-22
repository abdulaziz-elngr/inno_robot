import type { Metadata } from "next";
import { MediaManager } from "@/components/admin/media-manager";
import { requireUserPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Media library" };

/** Media library — browser → Cloudinary signed uploads, recorded in our database. */
export default async function MediaPage() {
  await requireUserPage("media.manage", "/admin/media");
  return <MediaManager />;
}
