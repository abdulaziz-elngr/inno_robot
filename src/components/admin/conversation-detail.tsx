"use client";

import { useRouter } from "next/navigation";
import { PageHeader, Panel, PanelBody } from "@/components/admin/primitives";
import { adminFetch, useAsyncData } from "@/components/admin/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";

type Message = { id: string; role: string; content: string; origin: string | null; intent: string | null; createdAt: string };
type Detail = {
  conversation: { id: string; language: string; messageCount: number; createdAt: string; updatedAt: string; studentId: string | null; guestId: string | null };
  messages: Message[];
};

export function ConversationDetail({ id }: { id: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { data, loading, error } = useAsyncData(() => adminFetch<Detail>(`/api/admin/conversations/${id}`), [id]);

  if (loading) return <div className="skeleton h-64 w-full" />;
  if (error || !data) {
    return (
      <Panel>
        <PanelBody>
          <p className="text-sm text-error">{error ?? t("admin.system.conversations.notFound")}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push("/admin/conversations")}>
            {t("admin.system.conversations.backToList")}
          </Button>
        </PanelBody>
      </Panel>
    );
  }

  const { conversation, messages } = data;

  return (
    <div>
      <PageHeader
        title={t("admin.system.conversations.detail")}
        description={`${conversation.id.slice(0, 8)} · ${conversation.language.toUpperCase()} · ${conversation.messageCount}`}
        actions={
          <Button variant="outline" onClick={() => router.push("/admin/conversations")}>
            {t("admin.system.conversations.backToList")}
          </Button>
        }
      />

      <Panel>
        <div className="divide-y divide-border/70">
          {messages.map((message) => (
            <div key={message.id} className={`flex flex-col gap-1 px-5 py-4 ${message.role === "USER" ? "bg-lavender/40 dark:bg-primary/5" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={message.role === "USER" ? "default" : "info"}>{message.role}</Badge>
                {message.intent && <Badge variant="outline">{message.intent}</Badge>}
                {message.origin && <span className="font-mono text-[10px] text-subtle">{message.origin}</span>}
                <span className="ms-auto text-xs text-muted">{new Date(message.createdAt).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{message.content}</p>
            </div>
          ))}
          {messages.length === 0 && <p className="px-5 py-6 text-sm text-muted">{t("admin.common.noData")}</p>}
        </div>
      </Panel>
    </div>
  );
}
