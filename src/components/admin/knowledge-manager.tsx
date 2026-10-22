"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader, Panel, PanelBody } from "@/components/admin/primitives";
import { adminFetch, useAsyncData } from "@/components/admin/client";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/provider";

type ArticleRow = {
  id: string;
  title: string;
  language: string;
  status: string;
  updatedAt: string | null;
  publishedAt: string | null;
  sourceDocument: string | null;
  categoryId: string | null;
  categoryNameEn: string | null;
  excerpt: string | null;
};
type FullArticle = ArticleRow & { content: string; tags: string[]; reviewAt: string | null };
type Category = { id: string; key: string; nameEn: string; nameAr: string };

const PAGE_SIZE = 20;
const emptyForm = { title: "", content: "", language: "en", tags: "", categoryId: "", status: "DRAFT", sourceDocument: "" };

export function KnowledgeManager({ initialPage }: { initialPage: number }) {
  const { t, locale } = useI18n();
  const toast = useToast();

  const [page, setPage] = useState(initialPage);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FullArticle | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [categoryDialog, setCategoryDialog] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ key: "", nameEn: "", nameAr: "" });
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (q) params.set("q", q);
  if (statusFilter) params.set("status", statusFilter);
  if (languageFilter) params.set("language", languageFilter);

  const { data, error, loading, reload } = useAsyncData(
    () => adminFetch<{ rows: ArticleRow[]; total: number }>(`/api/admin/knowledge?${params}`),
    [params.toString()],
  );
  const { data: categoriesData, reload: reloadCategories } = useAsyncData(() => adminFetch<{ rows: Category[] }>("/api/admin/knowledge/categories"), []);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const categories = categoriesData?.rows ?? [];

  function resetForm() {
    setForm({ ...emptyForm, categoryId: "" });
    setFormError(null);
    setEditing(null);
  }

  async function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  async function openEdit(row: ArticleRow) {
    setFormError(null);
    try {
      const full = await adminFetch<FullArticle>(`/api/admin/knowledge/${row.id}`);
      setEditing(full);
      setForm({
        title: full.title,
        content: full.content,
        language: full.language,
        tags: (full.tags ?? []).join(", "),
        categoryId: full.categoryId ?? "",
        status: full.status,
        sourceDocument: full.sourceDocument ?? "",
      });
      setDialogOpen(true);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t("admin.common.loadError"), variant: "error" });
    }
  }

  async function save() {
    setBusy(true);
    setFormError(null);
    const payload = {
      title: form.title,
      content: form.content,
      language: form.language,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      categoryId: form.categoryId || null,
      status: form.status,
      sourceDocument: form.sourceDocument,
    };
    try {
      if (editing) {
        await adminFetch(`/api/admin/knowledge/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await adminFetch("/api/admin/knowledge", { method: "POST", body: JSON.stringify(payload) });
      }
      toast({ title: editing ? t("admin.common.saved") : t("admin.common.created"), variant: "success" });
      setDialogOpen(false);
      resetForm();
      reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("admin.common.loadError"));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(row: ArticleRow, status: "PUBLISHED" | "DRAFT") {
    try {
      await adminFetch(`/api/admin/knowledge/${row.id}/status`, { method: "POST", body: JSON.stringify({ status }) });
      toast({ title: status === "PUBLISHED" ? t("admin.content.knowledge.published2") : t("admin.content.knowledge.unpublished"), variant: "success" });
      reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t("admin.common.loadError"), variant: "error" });
    }
  }

  async function remove(row: ArticleRow) {
    if (!window.confirm(t("admin.common.deleteTitle", { name: row.title }))) return;
    try {
      await adminFetch(`/api/admin/knowledge/${row.id}`, { method: "DELETE" });
      toast({ title: t("admin.common.deleted"), variant: "success" });
      reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t("admin.common.loadError"), variant: "error" });
    }
  }

  async function saveCategory() {
    try {
      await adminFetch("/api/admin/knowledge/categories", { method: "POST", body: JSON.stringify(categoryForm) });
      toast({ title: t("admin.common.created"), variant: "success" });
      setCategoryDialog(false);
      setCategoryForm({ key: "", nameEn: "", nameAr: "" });
      reloadCategories();
    } catch (e) {
      setCategoryError(e instanceof Error ? e.message : t("admin.common.loadError"));
    }
  }

  return (
    <div>
      <PageHeader
        title={t("admin.content.knowledge.title")}
        description={t("admin.content.knowledge.description")}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setCategoryError(null);
                setCategoryDialog(true);
              }}
            >
              {t("admin.content.knowledge.categories")}
            </Button>
            <Button onClick={() => void openCreate()}>
              <Plus className="size-4" aria-hidden />
              {t("admin.content.knowledge.add")}
            </Button>
          </>
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
            placeholder={t("admin.content.knowledge.searchPlaceholder")}
            aria-label={t("common.search")}
            className="max-w-xs flex-1"
          />
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label={t("admin.content.knowledge.status")}
            className="w-44"
          >
            <option value="">{t("admin.content.knowledge.filterStatus")}</option>
            <option value="DRAFT">{t("admin.content.knowledge.statusDraft")}</option>
            <option value="PUBLISHED">{t("admin.content.knowledge.statusPublished")}</option>
            <option value="ARCHIVED">{t("admin.content.knowledge.statusArchived")}</option>
          </Select>
          <Select
            value={languageFilter}
            onChange={(e) => {
              setLanguageFilter(e.target.value);
              setPage(1);
            }}
            aria-label={t("admin.content.knowledge.language")}
            className="w-40"
          >
            <option value="">{t("admin.content.knowledge.filterLanguage")}</option>
            <option value="ar">{t("admin.content.knowledge.langAr")}</option>
            <option value="en">{t("admin.content.knowledge.langEn")}</option>
            <option value="both">{t("admin.content.knowledge.langBoth")}</option>
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
          <EmptyState title={t("admin.content.knowledge.empty")} description={t("admin.content.knowledge.emptyHint")} />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>{t("admin.content.knowledge.titleField")}</TH>
                  <TH>{t("admin.content.knowledge.language")}</TH>
                  <TH>{t("admin.content.knowledge.category")}</TH>
                  <TH>{t("common.status")}</TH>
                  <TH>{t("admin.common.updatedAt")}</TH>
                  <TH className="text-end">{t("common.actions")}</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <p className="font-medium">{row.title}</p>
                      {row.excerpt && <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-muted">{row.excerpt}</p>}
                    </TD>
                    <TD className="text-muted">{row.language === "ar" ? t("admin.content.knowledge.langAr") : row.language === "en" ? t("admin.content.knowledge.langEn") : t("admin.content.knowledge.langBoth")}</TD>
                    <TD className="text-muted">{row.categoryNameEn ?? t("admin.content.knowledge.noCategory")}</TD>
                    <TD>
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    </TD>
                    <TD className="text-xs text-muted">{row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "â€”"}</TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        {row.status !== "PUBLISHED" ? (
                          <Button variant="ghost" size="sm" onClick={() => void setStatus(row, "PUBLISHED")}>
                            {t("admin.content.knowledge.publish")}
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => void setStatus(row, "DRAFT")}>
                            {t("admin.content.knowledge.unpublish")}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => void openEdit(row)}>
                          {t("common.edit")}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-error" onClick={() => void remove(row)}>
                          {t("common.delete")}
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

      {/* Article create / edit */}
      <Dialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          resetForm();
        }}
        title={
          editing
            ? t("admin.common.editTitle", { name: editing.title })
            : t("admin.common.createTitle", { name: t("admin.content.knowledge.titleField") })
        }
        className="max-w-2xl"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void save()} loading={busy} disabled={!form.title || !form.content}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="grid max-h-[65vh] gap-4 overflow-y-auto">
          <Field label={t("admin.content.knowledge.titleField")} required error={formError}>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label={t("admin.content.knowledge.content")} required hint={t("admin.content.knowledge.contentHint")}>
            <Textarea rows={8} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("admin.content.knowledge.language")}>
              <Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                <option value="en">{t("admin.content.knowledge.langEn")}</option>
                <option value="ar">{t("admin.content.knowledge.langAr")}</option>
                <option value="both">{t("admin.content.knowledge.langBoth")}</option>
              </Select>
            </Field>
            <Field label={t("admin.content.knowledge.category")}>
              <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">{t("admin.content.knowledge.noCategory")}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {locale === "ar" ? category.nameAr : category.nameEn}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("admin.content.knowledge.tags")} hint={t("admin.content.knowledge.tagsHint")}>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </Field>
            <Field label={t("admin.content.knowledge.status")}>
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="DRAFT">{t("admin.content.knowledge.statusDraft")}</option>
                <option value="PUBLISHED">{t("admin.content.knowledge.statusPublished")}</option>
                <option value="ARCHIVED">{t("admin.content.knowledge.statusArchived")}</option>
              </Select>
            </Field>
            <Field label={t("admin.content.knowledge.sourceDocument")}>
              <Input value={form.sourceDocument} onChange={(e) => setForm({ ...form, sourceDocument: e.target.value })} />
            </Field>
          </div>
        </div>
      </Dialog>

      {/* Category picker */}
      <Dialog
        open={categoryDialog}
        onClose={() => setCategoryDialog(false)}
        title={t("admin.content.knowledge.categories")}
        footer={
          <>
            <Button variant="outline" onClick={() => setCategoryDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void saveCategory()} disabled={!categoryForm.key || !categoryForm.nameEn || !categoryForm.nameAr}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("admin.content.knowledge.categoryKey")} required error={categoryError}>
              <Input value={categoryForm.key} onChange={(e) => setCategoryForm({ ...categoryForm, key: e.target.value })} dir="ltr" />
            </Field>
            <Field label={t("admin.content.knowledge.categoryNameEn")} required>
              <Input value={categoryForm.nameEn} onChange={(e) => setCategoryForm({ ...categoryForm, nameEn: e.target.value })} dir="ltr" />
            </Field>
            <Field label={t("admin.content.knowledge.categoryNameAr")} required>
              <Input value={categoryForm.nameAr} onChange={(e) => setCategoryForm({ ...categoryForm, nameAr: e.target.value })} dir="rtl" />
            </Field>
          </div>
          <ul className="divide-y divide-border/70 rounded-xl border border-border/70">
            {categories.map((category) => (
              <li key={category.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="font-medium">{locale === "ar" ? category.nameAr : category.nameEn}</span>
                <span className="font-mono text-xs text-muted">{category.key}</span>
              </li>
            ))}
            {categories.length === 0 && <li className="px-3 py-2 text-sm text-muted">{t("admin.common.noData")}</li>}
          </ul>
        </div>
      </Dialog>
    </div>
  );
}
