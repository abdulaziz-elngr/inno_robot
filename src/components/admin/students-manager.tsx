"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader, Panel, PanelBody } from "@/components/admin/primitives";
import { adminFetch, useAsyncData } from "@/components/admin/client";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/provider";

type StudentRow = {
  id: string;
  universityId: string;
  nameEn: string;
  nameAr: string;
  firstNameEn: string;
  firstNameAr: string;
  email: string | null;
  facultyId: string | null;
  departmentId: string | null;
  facultyNameEn: string | null;
  status: string;
};
type Faculty = { id: string; code: string; nameEn: string; nameAr: string };
type Department = { id: string; facultyId: string; code: string; nameEn: string; nameAr: string };

const emptyForm = { universityId: "", nameEn: "", nameAr: "", firstNameEn: "", firstNameAr: "", email: "", facultyId: "", departmentId: "", status: "ACTIVE" };

export function StudentsManager({ initialPage }: { initialPage: number }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const pageSize = 20;

  const [page, setPage] = useState(initialPage);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [facultyFilter, setFacultyFilter] = useState("");
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q) params.set("q", q);
    if (statusFilter) params.set("status", statusFilter);
    if (facultyFilter) params.set("facultyId", facultyFilter);
    return params.toString();
  }, [page, q, statusFilter, facultyFilter]);

  const { data, error, loading, reload } = useAsyncData(
    () => adminFetch<{ rows: StudentRow[]; total: number }>(`/api/admin/students?${query}`),
    [query],
  );
  const { data: facultiesData } = useAsyncData(() => adminFetch<{ rows: Faculty[] }>("/api/admin/faculties"), []);
  const { data: departmentsData } = useAsyncData(
    () => adminFetch<{ rows: Department[] }>(`/api/admin/departments${facultyFilter ? `?facultyId=${facultyFilter}` : ""}`),
    [facultyFilter],
  );

  const faculties = facultiesData?.rows ?? [];
  const departments = departmentsData?.rows ?? [];
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const openCreate = useCallback(() => {
    setForm({ ...emptyForm });
    setFormError(null);
    setCreating(true);
  }, []);

  const openEdit = useCallback((row: StudentRow) => {
    setForm({
      universityId: row.universityId,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      firstNameEn: row.firstNameEn,
      firstNameAr: row.firstNameAr,
      email: row.email ?? "",
      facultyId: row.facultyId ?? "",
      departmentId: row.departmentId ?? "",
      status: row.status,
    });
    setFormError(null);
    setEditing(row);
  }, []);

  async function save() {
    setSaving(true);
    setFormError(null);
    const payload = {
      universityId: form.universityId,
      nameEn: form.nameEn,
      nameAr: form.nameAr,
      firstNameEn: form.firstNameEn,
      firstNameAr: form.firstNameAr,
      email: form.email,
      facultyId: form.facultyId || null,
      departmentId: form.departmentId || null,
      status: form.status,
    };
    try {
      if (editing) {
        await adminFetch(`/api/admin/students/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast({ title: t("admin.common.saved"), variant: "success" });
      } else {
        await adminFetch("/api/admin/students", { method: "POST", body: JSON.stringify(payload) });
        toast({ title: t("admin.common.created"), variant: "success" });
      }
      setEditing(null);
      setCreating(false);
      reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("admin.common.loadError"));
    } finally {
      setSaving(false);
    }
  }

  async function archive(row: StudentRow) {
    const name = locale === "ar" ? row.nameAr : row.nameEn;
    const ok = await confirm({ title: t("admin.students.students.archiveTitle", { name }), description: t("admin.students.students.archiveBody"), destructive: true, confirmLabel: t("admin.students.students.archive") });
    if (!ok) return;
    try {
      await adminFetch(`/api/admin/students/${row.id}`, { method: "DELETE" });
      toast({ title: t("admin.students.students.archived"), variant: "success" });
      reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t("admin.common.loadError"), variant: "error" });
    }
  }

  return (
    <div>
      <PageHeader
        title={t("admin.students.students.title")}
        description={t("admin.students.subtitle")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            {t("admin.students.students.add")}
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
            placeholder={t("admin.students.students.searchPlaceholder")}
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
            <option value="">{t("admin.students.students.filterStatus")}</option>
            <option value="ACTIVE">{t("admin.students.students.statusActive")}</option>
            <option value="ON_LEAVE">{t("admin.students.students.statusOnLeave")}</option>
            <option value="ARCHIVED">{t("admin.students.students.statusArchived")}</option>
          </Select>
          <Select
            value={facultyFilter}
            onChange={(e) => {
              setFacultyFilter(e.target.value);
              setPage(1);
            }}
            aria-label={t("admin.students.students.faculty")}
            className="w-48"
          >
            <option value="">{t("admin.students.students.filterFaculty")}</option>
            {faculties.map((faculty) => (
              <option key={faculty.id} value={faculty.id}>
                {locale === "ar" ? faculty.nameAr : faculty.nameEn}
              </option>
            ))}
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
            <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
              {t("common.retry")}
            </Button>
          </PanelBody>
        ) : rows.length === 0 ? (
          <EmptyState title={t("admin.students.students.empty")} description={t("admin.students.students.emptyHint")} />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>{t("admin.students.students.universityId")}</TH>
                  <TH>{t("admin.common.name")}</TH>
                  <TH>{t("admin.students.students.faculty")}</TH>
                  <TH>{t("common.status")}</TH>
                  <TH className="text-end">{t("common.actions")}</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD className="font-mono text-xs">{row.universityId}</TD>
                    <TD className="font-medium">{locale === "ar" ? row.nameAr : row.nameEn}</TD>
                    <TD className="text-muted">{row.facultyNameEn ?? t("admin.students.students.noFaculty")}</TD>
                    <TD>
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    </TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                          {t("common.edit")}
                        </Button>
                        {row.status !== "ARCHIVED" && (
                          <Button variant="ghost" size="sm" className="text-error" onClick={() => void archive(row)}>
                            {t("admin.students.students.archive")}
                          </Button>
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

      {/* Create / edit dialog */}
      <Dialog
        open={creating || Boolean(editing)}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? t("admin.common.editTitle", { name: editing.nameEn }) : t("admin.common.createTitle", { name: t("admin.students.students.title") })}
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
            <Button onClick={() => void save()} loading={saving}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.students.students.universityId")} required error={formError}>
            <Input value={form.universityId} onChange={(e) => setForm({ ...form, universityId: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("common.status")}>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="ACTIVE">{t("admin.students.students.statusActive")}</option>
              <option value="ON_LEAVE">{t("admin.students.students.statusOnLeave")}</option>
              <option value="ARCHIVED">{t("admin.students.students.statusArchived")}</option>
            </Select>
          </Field>
          <Field label={t("admin.common.nameEn")} required>
            <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.common.nameAr")} required>
            <Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} dir="rtl" />
          </Field>
          <Field label={`${t("admin.common.name")} (EN)`} required>
            <Input value={form.firstNameEn} onChange={(e) => setForm({ ...form, firstNameEn: e.target.value })} dir="ltr" />
          </Field>
          <Field label={`${t("admin.common.name")} (AR)`} required>
            <Input value={form.firstNameAr} onChange={(e) => setForm({ ...form, firstNameAr: e.target.value })} dir="rtl" />
          </Field>
          <Field label={t("admin.students.students.email")}>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.students.students.faculty")}>
            <Select
              value={form.facultyId}
              onChange={(e) => setForm({ ...form, facultyId: e.target.value, departmentId: "" })}
            >
              <option value="">{t("admin.students.students.noFaculty")}</option>
              {faculties.map((faculty) => (
                <option key={faculty.id} value={faculty.id}>
                  {locale === "ar" ? faculty.nameAr : faculty.nameEn}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("admin.students.students.department")}>
            <Select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">{t("admin.students.students.noDepartment")}</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {locale === "ar" ? department.nameAr : department.nameEn}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
