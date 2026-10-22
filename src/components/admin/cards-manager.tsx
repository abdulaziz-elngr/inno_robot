"use client";

import { useCallback, useState } from "react";
import { Plus, ShieldOff } from "lucide-react";
import { PageHeader, Panel, PanelBody } from "@/components/admin/primitives";
import { adminFetch, useAsyncData } from "@/components/admin/client";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/provider";

type CardRow = {
  id: string;
  uidLast4: string;
  label: string | null;
  status: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  studentId: string;
  studentNameEn: string | null;
  studentNameAr: string | null;
};
type StudentOption = { id: string; nameEn: string; nameAr: string; universityId: string };

export function CardsManager({ initialPage }: { initialPage: number }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const pageSize = 20;

  const [page, setPage] = useState(initialPage);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [associateOpen, setAssociateOpen] = useState(false);
  const [revoking, setRevoking] = useState<CardRow | null>(null);
  const [form, setForm] = useState({ cardUid: "", studentId: "", label: "" });
  const [revokeReason, setRevokeReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (q) query.set("q", q);
  if (statusFilter) query.set("status", statusFilter);

  const { data, error, loading, reload } = useAsyncData(
    () => adminFetch<{ rows: CardRow[]; total: number }>(`/api/admin/cards?${query.toString()}`),
    [page, q, statusFilter],
  );

  // The associate dialog needs a student picker; the students API returns the list.
  const { data: studentsData } = useAsyncData(
    () => adminFetch<{ rows: StudentOption[] }>("/api/admin/students?pageSize=100"),
    [],
  );

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const closeAssociate = useCallback(() => {
    setAssociateOpen(false);
    setForm({ cardUid: "", studentId: "", label: "" });
    setFormError(null);
  }, []);

  async function associate() {
    setBusy(true);
    setFormError(null);
    try {
      await adminFetch("/api/admin/cards", {
        method: "POST",
        body: JSON.stringify({ action: "associate", studentId: form.studentId, cardUid: form.cardUid, label: form.label || undefined }),
      });
      toast({ title: t("admin.students.cards.associated"), variant: "success" });
      closeAssociate();
      reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("admin.common.loadError"));
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!revoking) return;
    setBusy(true);
    try {
      await adminFetch("/api/admin/cards", {
        method: "POST",
        body: JSON.stringify({ action: "revoke", cardId: revoking.id, reason: revokeReason }),
      });
      toast({ title: t("admin.students.cards.revoked"), variant: "success" });
      setRevoking(null);
      setRevokeReason("");
      reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t("admin.common.loadError"), variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("admin.students.cards.title")}
        description={t("admin.students.cards.associateHint")}
        actions={
          <Button onClick={() => setAssociateOpen(true)}>
            <Plus className="size-4" aria-hidden />
            {t("admin.students.cards.associate")}
          </Button>
        }
      />

      <Panel>
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder={t("admin.students.cards.searchPlaceholder")}
            aria-label={t("common.search")}
            className="max-w-xs flex-1"
          />
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label={t("common.status")}
            className="w-40"
          >
            <option value="">{t("admin.students.cards.filterStatus")}</option>
            <option value="ACTIVE">{t("admin.students.cards.statusActive")}</option>
            <option value="REVOKED">{t("admin.students.cards.statusRevoked")}</option>
            <option value="LOST">{t("admin.students.cards.statusLost")}</option>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <PanelBody>
            <p className="text-sm text-error">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
              {t("common.retry")}
            </Button>
          </PanelBody>
        ) : rows.length === 0 ? (
          <EmptyState title={t("admin.students.cards.empty")} description={t("admin.students.cards.emptyHint")} />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>{t("admin.students.cards.last4")}</TH>
                  <TH>{t("admin.students.cards.student")}</TH>
                  <TH>{t("admin.students.cards.label")}</TH>
                  <TH>{t("common.status")}</TH>
                  <TH>{t("admin.students.cards.lastSeen")}</TH>
                  <TH className="text-end">{t("common.actions")}</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD className="font-mono text-xs">â€¢â€¢â€¢â€¢ {row.uidLast4}</TD>
                    <TD className="font-medium">{locale === "ar" ? (row.studentNameAr ?? "â€”") : (row.studentNameEn ?? "â€”")}</TD>
                    <TD className="text-muted">{row.label ?? "â€”"}</TD>
                    <TD>
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    </TD>
                    <TD className="text-xs text-subtle">{row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleDateString() : "â€”"}</TD>
                    <TD>
                      <div className="flex justify-end">
                        {row.status === "ACTIVE" ? (
                          <Button variant="ghost" size="sm" className="text-error" onClick={() => setRevoking(row)}>
                            <ShieldOff className="size-3.5" aria-hidden />
                            {t("admin.students.cards.revoke")}
                          </Button>
                        ) : (
                          <span className="text-xs text-subtle">{row.revokedReason ?? "â€”"}</span>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={total} />
          </>
        )}
      </Panel>

      {/* Associate dialog */}
      <Dialog
        open={associateOpen}
        onClose={closeAssociate}
        title={t("admin.students.cards.associate")}
        description={t("admin.students.cards.associateHint")}
        footer={
          <>
            <Button variant="outline" onClick={closeAssociate}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void associate()} loading={busy} disabled={!form.cardUid || !form.studentId}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t("admin.students.cards.cardUid")} required error={formError} hint={t("admin.students.cards.associateHint")}>
            <Input value={form.cardUid} onChange={(e) => setForm({ ...form, cardUid: e.target.value })} dir="ltr" placeholder="04A1B2C3D4E5F6" />
          </Field>
          <Field label={t("admin.students.cards.student")} required>
            <Select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">{t("admin.common.selectPlaceholder")}</option>
              {(studentsData?.rows ?? []).map((student) => (
                <option key={student.id} value={student.id}>
                  {locale === "ar" ? student.nameAr : student.nameEn} â€” {student.universityId}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("admin.students.cards.label")} hint={t("admin.students.cards.labelHint")}>
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </Field>
        </div>
      </Dialog>

      {/* Revoke dialog */}
      <Dialog
        open={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        title={t("admin.students.cards.revokeTitle")}
        description={t("admin.students.cards.revokeBody")}
        footer={
          <>
            <Button variant="outline" onClick={() => setRevoking(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={() => void revoke()} loading={busy} disabled={revokeReason.trim().length < 3}>
              {t("admin.students.cards.revoke")}
            </Button>
          </>
        }
      >
        <Field label={t("admin.students.cards.revokeReason")} required hint={t("admin.students.cards.revokeReasonHint")}>
          <Input value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} />
        </Field>
      </Dialog>
    </div>
  );
}
