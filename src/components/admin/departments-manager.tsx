"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader, Panel, PanelBody } from "@/components/admin/primitives";
import { adminFetch, useAsyncData } from "@/components/admin/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/provider";

type Faculty = { id: string; code: string; nameEn: string; nameAr: string };
type Department = {
  id: string;
  facultyId: string;
  code: string;
  nameEn: string;
  nameAr: string;
  active: boolean;
  facultyNameEn: string;
};

const emptyForm = { facultyId: "", code: "", nameEn: "", nameAr: "", active: true };

export function DepartmentsManager() {
  const { t, locale } = useI18n();
  const toast = useToast();

  const [facultyFilter, setFacultyFilter] = useState("");
  const [editing, setEditing] = useState<Department | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsyncData(
    () => adminFetch<{ rows: Department[] }>(`/api/admin/departments${facultyFilter ? `?facultyId=${facultyFilter}` : ""}`),
    [facultyFilter],
  );
  const { data: facultiesData } = useAsyncData(() => adminFetch<{ rows: Faculty[] }>("/api/admin/faculties"), []);

  const departments = data?.rows ?? [];
  const faculties = facultiesData?.rows ?? [];

  function openCreate() {
    setForm({ ...emptyForm, facultyId: facultyFilter || (faculties[0]?.id ?? "") });
    setFormError(null);
    setCreating(true);
  }

  function openEdit(row: Department) {
    setForm({ facultyId: row.facultyId, code: row.code, nameEn: row.nameEn, nameAr: row.nameAr, active: row.active });
    setFormError(null);
    setEditing(row);
  }

  async function save() {
    setBusy(true);
    setFormError(null);
    try {
      if (editing) {
        await adminFetch(`/api/admin/departments/${editing.id}`, { method: "PATCH", body: JSON.stringify(form) });
      } else {
        await adminFetch("/api/admin/departments", { method: "POST", body: JSON.stringify(form) });
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
        title={t("admin.students.departments.title")}
        description={t("admin.students.departments.description")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            {t("admin.students.departments.add")}
          </Button>
        }
      />
      <Panel>
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3">
          <Select
            value={facultyFilter}
            onChange={(e) => setFacultyFilter(e.target.value)}
            aria-label={t("admin.students.departments.faculty")}
            className="w-56"
          >
            <option value="">{t("admin.students.departments.filterFaculty")}</option>
            {faculties.map((faculty) => (
              <option key={faculty.id} value={faculty.id}>
                {locale === "ar" ? faculty.nameAr : faculty.nameEn}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            <div className="skeleton h-10 w-full" />
          </div>
        ) : error ? (
          <PanelBody>
            <p className="text-sm text-error">{error}</p>
          </PanelBody>
        ) : departments.length === 0 ? (
          <EmptyState title={t("admin.students.departments.empty")} description={t("admin.students.departments.emptyHint")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("admin.common.code")}</TH>
                <TH>{t("admin.common.nameEn")}</TH>
                <TH>{t("admin.common.nameAr")}</TH>
                <TH>{t("admin.students.departments.faculty")}</TH>
                <TH>{t("common.status")}</TH>
                <TH className="text-end">{t("common.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {departments.map((row) => (
                <TR key={row.id}>
                  <TD className="font-mono text-xs">{row.code}</TD>
                  <TD className="font-medium">{row.nameEn}</TD>
                  <TD dir="rtl">{row.nameAr}</TD>
                  <TD className="text-muted">{locale === "ar" ? row.facultyNameEn : row.facultyNameEn}</TD>
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
        title={
          editing
            ? t("admin.common.editTitle", { name: editing.nameEn })
            : t("admin.common.createTitle", { name: t("admin.students.departments.title") })
        }
        className="max-w-xl"
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
            <Button onClick={() => void save()} loading={busy} disabled={!form.facultyId || !form.code || !form.nameEn || !form.nameAr}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.students.departments.faculty")} required error={formError}>
            <Select value={form.facultyId} onChange={(e) => setForm({ ...form, facultyId: e.target.value })}>
              <option value="" disabled>
                {t("admin.common.selectPlaceholder")}
              </option>
              {faculties.map((faculty) => (
                <option key={faculty.id} value={faculty.id}>
                  {locale === "ar" ? faculty.nameAr : faculty.nameEn}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("admin.common.code")} required>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.common.nameEn")} required>
            <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.common.nameAr")} required>
            <Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} dir="rtl" />
          </Field>
          <div className="flex items-end pb-2">
            <Switch checked={form.active} onChange={(checked) => setForm({ ...form, active: checked })} label={t("common.active")} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
