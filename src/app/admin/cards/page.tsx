import type { Metadata } from "next";
import { CardsManager } from "@/components/admin/cards-manager";
import { requireUserPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "NFC cards" };

/** NFC card registry: associate, inspect and revoke student cards. */
export default async function CardsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireUserPage("cards.manage", "/admin/cards");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  return <CardsManager initialPage={page} />;
}
