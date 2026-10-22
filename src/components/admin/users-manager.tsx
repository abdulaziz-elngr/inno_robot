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
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/provider";

type UserRow = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  locale: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  roleKeys: string[];
};

const PAGE_SIZE = 20;
const ROLE_OPTIONS = ["SUPER_ADMIN", "ADMIN", "UNIVERSITY_STAFF", "ROBOT_OPERATOR", "CONTENT_MANAGER", "VIEWER"] as const;
const emptyForm = { email: "", name: "", password: "", roles: ["VIEWER"] as string[], active: true };

export function UsersManager({ initialPage }: { initialPage: number }) {
  const { t } = useI18n();
  const toast = useToast();

  const [page, setPage] = useState(initialPage);
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (q) params.set("q", q);

  const { data, error, loading, reload } = useAsyncData(
    () => adminFetch<{ rows: UserRow[]; total: number }>(`/api/admin/users?${params}`),
    [params.toString()],
  );

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  function openCreate() {
    setForm({ ...emptyForm });
    setFormError(null);
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: UserRow) {
    setForm({ email: row.email, name: row.name, password: "", roles: row.roleKeys, active: row.active });
    setFormError(null);
    setEditing(row);
    setDialogOpen(true);
  }

  function toggleRole(role: string) {
    setForm((current) => ({
      ...current,
      roles: current.roles.includes(role) ? current.roles.filter((r) => r !== role) : [...current.roles, role],
    }));
  }

  async function save() {
    if (!form.roles.length) {
      setFormError(t("admin.system.users.roleAtLeastOne"));
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (editing) {
        await adminFetch(`/api/admin/users/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: form.name, roles: form.roles, active: form.active, newPassword: form.password }),
        });
      } else {
        await adminFetch("/api/admin/users", {
          method: "POST",
          body: JSON.stringify({ email: form.email, name: form.name, password: form.password, roles: form.roles, active: form.active }),
        });
      }
      toast({ title: editing ? t("admin.common.saved") : t("admin.common.created"), variant: "success" });
      setDialogOpen(false);
      setEditing(null);
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
        title={t("admin.system.users.title")}
        description={t("admin.system.users.description")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            {t("admin.system.users.add")}
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
            placeholder={t("admin.system.users.searchPlaceholder")}
            aria-label={t("common.search")}
            className="max-w-xs flex-1"
          />
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
          </PanelBody>
        ) : rows.length === 0 ? (
          <EmptyState title={t("admin.system.users.empty")} description={t("admin.system.users.emptyHint")} />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>{t("admin.system.users.email")}</TH>
                  <TH>{t("admin.system.users.name")}</TH>
                  <TH>{t("admin.system.users.roles")}</TH>
                  <TH>{t("common.status")}</TH>
                  <TH>{t("admin.system.users.lastLogin")}</TH>
                  <TH className="text-end">{t("common.actions")}</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD className="font-mono text-xs">{row.email}</TD>
                    <TD className="font-medium">{row.name}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {row.roleKeys.map((role) => (
                          <Badge key={role} variant="outline">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </TD>
                    <TD>
                      <Badge variant={row.active ? "success" : "outline"}>{row.active ? t("admin.common.enabled") : t("admin.common.disabled")}</Badge>
                    </TD>
                    <TD className="text-xs text-muted">{row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString() : t("admin.system.users.neverLoggedIn")}</TD>
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
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
          </>
        )}
      </Panel>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? t("admin.common.editTitle", { name: editing.name }) : t("admin.common.createTitle", { name: t("admin.system.users.title") })}
        className="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void save()} loading={busy} disabled={!form.name || (!editing && (!form.email || !form.password))}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("admin.system.users.email")} required error={formError}>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" disabled={Boolean(editing)} />
            </Field>
            <Field label={t("admin.system.users.name")} required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
          </div>
          <Field
            label={editing ? t("admin.system.users.newPassword") : t("admin.system.users.password")}
            required={!editing}
            hint={editing ? t("admin.system.users.newPasswordHint") : t("admin.system.users.passwordHint")}
          >
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} dir="ltr" autoComplete="new-password" />
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium text-fg">{t("admin.system.users.roles")}</p>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  aria-pressed={form.roles.includes(role)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    form.roles.includes(role) ? "border-primary bg-primary text-white" : "border-border text-muted hover:border-primary/40"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end">
            <Switch checked={form.active} onChange={(checked) => setForm({ ...form, active: checked })} label={t("admin.system.users.active")} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
