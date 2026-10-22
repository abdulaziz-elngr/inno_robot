import type { Metadata } from "next";
import { ConversationsManager } from "@/components/admin/conversations-manager";
import { requireUserPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conversations" };

/** Assistant conversation transcripts (retention window selectable in the UI). */
export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireUserPage("conversations.read", "/admin/conversations");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  return <ConversationsManager initialPage={page} />;
}
