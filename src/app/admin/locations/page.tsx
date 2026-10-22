import type { Metadata } from "next";
import { LocationsManager } from "@/components/admin/locations-manager";
import { requireUserPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Campus locations" };

/** Campus directory editor — buildings, floors and locations. */
export default async function LocationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireUserPage("locations.manage", "/admin/locations");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  return <LocationsManager initialPage={page} />;
}
