"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Panel, PanelBody } from "@/components/admin/primitives";
import { adminFetch, useAsyncData } from "@/components/admin/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/provider";

type ConversationRow = {
  id: string;
  language: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  studentFirstNameEn: string | null;
  studentFirstNameAr: string | null;
  isGuest: boolean;
};

const PAGE_SIZE = 20;

export function ConversationsManager({ initialPage }: { initialPage: number }) {
  const { t, locale } = useI18n();
  const router = useRouter();

  const [page, setPage] = useState(initialPage);
  const [language, setLanguage] = useState("");
  const [days, setDays] = useState("30");

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), days });
  if (language) params.set("language", language);

  const { data, error, loading } = useAsyncData(
    () => adminFetch<{ rows: ConversationRow[]; total: number }>(`/api/admin/conversations?${params}`),
    [params.toString()],
  );

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <PageHeader title={t("admin.system.conversations.title")} description={t("admin.system.conversations.description")} />

      <Panel>
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3">
          <Select value={language} onChange={(e) => { setLanguage(e.target.value); setPage(1); }} aria-label={t("admin.system.conversations.language")} className="w-40">
            <option value="">{t("admin.system.conversations.language")}</option>
            <option value="ar">{t("admin.content.knowledge.langAr")}</option>
            <option value="en">{t("admin.content.knowledge.langEn")}</option>
          </Select>
          <Select value={days} onChange={(e) => { setDays(e.target.value); setPage(1); }} aria-label={t("admin.system.conversations.days")} className="w-36">
            <option value="7">{t("admin.system.analytics.range7")}</option>
            <option value="30">{t("admin.system.analytics.range30")}</option>
            <option value="90">90</option>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <PanelBody>
            <p className="text-sm text-error">{error}</p>
          </PanelBody>
        ) : rows.length === 0 ? (
          <EmptyState title={t("admin.system.conversations.empty")} description={t("admin.system.conversations.emptyHint")} />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>{t("admin.system.conversations.student")}</TH>
                  <TH>{t("admin.system.conversations.language")}</TH>
                  <TH>{t("admin.system.conversations.messageCount")}</TH>
                  <TH>{t("admin.system.conversations.updatedAt")}</TH>
                  <TH className="text-end">{t("common.actions")}</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD className="font-medium">
                      {row.studentFirstNameEn || row.studentFirstNameAr
                        ? locale === "ar"
                          ? (row.studentFirstNameAr ?? row.studentFirstNameEn)
                          : (row.studentFirstNameEn ?? row.studentFirstNameAr)
                        : t("admin.system.conversations.guest")}
                    </TD>
                    <TD>
                      <Badge variant="outline">{row.language.toUpperCase()}</Badge>
                    </TD>
                    <TD className="tabular-nums">{row.messageCount}</TD>
                    <TD className="text-xs text-muted">{new Date(row.updatedAt).toLocaleString()}</TD>
                    <TD>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/conversations/${row.id}`)}>
                          {t("admin.common.detail")}
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
          </>
        )}
      </Panel>
    </div>
  );
}
