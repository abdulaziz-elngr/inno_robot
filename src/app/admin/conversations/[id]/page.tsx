import type { Metadata } from "next";
import { ConversationDetail } from "@/components/admin/conversation-detail";
import { requireUserPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conversation" };

/** Full transcript of a single assistant conversation. */
export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUserPage("conversations.read", `/admin/conversations/${id}`);
  return <ConversationDetail id={id} />;
}
