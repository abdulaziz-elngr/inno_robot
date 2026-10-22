import type { Metadata } from "next";
import { KnowledgeManager } from "@/components/admin/knowledge-manager";
import { requireUserPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Knowledge base" };

/** Knowledge base editor — the assistant only retrieves PUBLISHED articles. */
export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireUserPage("knowledge.manage", "/admin/knowledge");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  return <KnowledgeManager initialPage={page} />;
}
