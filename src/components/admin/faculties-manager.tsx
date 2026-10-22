"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader, Panel, PanelBody } from "@/components/admin/primitives";
import { adminFetch, useAsyncData } from "@/components/admin/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/provider";

type Faculty = { id: string; code: string; nameEn: string; nameAr: string; active: boolean; departmentCount: number };

export function FacultiesManager() {
  const { t } = useI18n();
  const toast = useToast();
  const { data, loading, error, reload } = useAsyncData(() => adminFetch<{ rows: Faculty[] }>("/api/admin/faculties"), []);

  const [editing, setEditing] = useState<Faculty | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: "", nameEn: "", nameAr: "", active: true });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openCreate() {
    setForm({ code: "", nameEn: "", nameAr: "", active: true });
    setFormError(null);
    setCreating(true);
  }

  function openEdit(row: Faculty) {
    setForm({ code: row.code, nameEn: row.nameEn, nameAr: row.nameAr, active: row.active });
    setFormError(null);
    setEditing(row);
  }

  async function save() {
    setBusy(true);
    setFormError(null);
    try {
      if (editing) {
        await adminFetch(`/api/admin/faculties/${editing.id}`, { method: "PATCH", body: JSON.stringify(form) });
      } else {
        await adminFetch("/api/admin/faculties", { method: "POST", body: JSON.stringify(form) });
      }
      toast({ title: editing ? t("admin.common.saved") : t("admin.common.created"), variant: "success" });
      setEditing(null);
      setCreating(false);
      reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("admin.common.loadError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("admin.students.faculties.title")}
        description={t("admin.students.faculties.emptyHint")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            {t("admin.students.faculties.add")}
          </Button>
        }
      />
      <Panel>
        {loading ? (
          <div className="space-y-2 p-4">
            <div className="skeleton h-10 w-full" />
          </div>
        ) : error ? (
          <PanelBody>
            <p className="text-sm text-error">{error}</p>
          </PanelBody>
        ) : (data?.rows.length ?? 0) === 0 ? (
          <EmptyState title={t("admin.students.faculties.empty")} description={t("admin.students.faculties.emptyHint")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("admin.common.code")}</TH>
                <TH>{t("admin.common.nameEn")}</TH>
                <TH>{t("admin.common.nameAr")}</TH>
                <TH>{t("admin.students.faculties.departments")}</TH>
                <TH>{t("common.status")}</TH>
                <TH className="text-end">{t("common.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {(data?.rows ?? []).map((row) => (
                <TR key={row.id}>
                  <TD className="font-mono text-xs">{row.code}</TD>
                  <TD className="font-medium">{row.nameEn}</TD>
                  <TD dir="rtl">{row.nameAr}</TD>
                  <TD className="text-muted">{row.departmentCount}</TD>
                  <TD>
                    <Badge variant={row.active ? "success" : "outline"}>{row.active ? t("common.active") : t("common.inactive")}</Badge>
                  </TD>
                  <TD>
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                        {t("common.edit")}
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Panel>

      <Dialog
        open={creating || Boolean(editing)}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? t("admin.common.editTitle", { name: editing.nameEn }) : t("admin.common.createTitle", { name: t("admin.students.faculties.title") })}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void save()} loading={busy} disabled={!form.code || !form.nameEn || !form.nameAr}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.common.code")} required error={formError}>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} dir="ltr" />
          </Field>
          <div className="flex items-end pb-2">
            <Switch checked={form.active} onChange={(checked) => setForm({ ...form, active: checked })} label={t("common.active")} />
          </div>
          <Field label={t("admin.common.nameEn")} required>
            <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.common.nameAr")} required>
            <Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} dir="rtl" />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
