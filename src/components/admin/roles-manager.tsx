"use client";

import { useState } from "react";
import { PageHeader, Panel, PanelBody } from "@/components/admin/primitives";
import { adminFetch, useAsyncData } from "@/components/admin/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/provider";

type Role = {
  id: string;
  key: string;
  nameEn: string;
  nameAr: string;
  description: string | null;
  isSuperAdmin: boolean;
  permissionKeys: string[];
};
type Permission = { id: string; key: string; descriptionEn: string; descriptionAr: string };

export function RolesManager() {
  const { t, locale } = useI18n();
  const toast = useToast();

  const { data, loading, error, reload } = useAsyncData(() => adminFetch<{ rows: Role[]; permissions: Permission[] }>("/api/admin/roles"), []);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  const roles = data?.rows ?? [];
  const permissions = data?.permissions ?? [];
  const role = roles.find((r) => r.key === (selectedKey ?? roles[0]?.key));

  function selectRole(next: Role) {
    setSelectedKey(next.key);
    setSelected([...next.permissionKeys]);
  }

  function toggle(key: string) {
    setSelected((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));
  }

  async function save() {
    if (!role) return;
    setBusy(true);
    try {
      await adminFetch("/api/admin/roles", {
        method: "PUT",
        body: JSON.stringify({
          key: role.key,
          nameEn: role.nameEn,
          nameAr: role.nameAr,
          description: role.description ?? "",
          permissions: selected,
        }),
      });
      toast({ title: t("admin.system.roles.saved"), variant: "success" });
      reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t("admin.common.loadError"), variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  const visiblePermissions = permissions.filter((permission) => {
    if (!filter.trim()) return true;
    const needle = filter.trim().toLowerCase();
    const description = locale === "ar" ? permission.descriptionAr : permission.descriptionEn;
    return permission.key.toLowerCase().includes(needle) || description.toLowerCase().includes(needle);
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-96 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <Panel>
        <PanelBody>
          <p className="text-sm text-error">{error}</p>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <div>
      <PageHeader title={t("admin.system.roles.title")} description={t("admin.system.roles.description")} />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Panel className="h-max">
          <ul className="divide-y divide-border/70">
            {roles.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => selectRole(item)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-start transition ${
                    role?.key === item.key ? "bg-lavender/70 dark:bg-primary/15" : "hover:bg-border/40"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-medium text-fg">{locale === "ar" ? item.nameAr : item.nameEn}</span>
                    <span className="block font-mono text-[10px] text-subtle">{item.key}</span>
                  </span>
                  {item.isSuperAdmin && <Badge variant="info">{t("admin.system.roles.superAdmin")}</Badge>}
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-fg">{role ? (locale === "ar" ? role.nameAr : role.nameEn) : ""}</h2>
              <p className="mt-0.5 text-xs text-muted">{role?.isSuperAdmin ? t("admin.system.roles.superAdminHint") : role?.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t("admin.system.roles.searchPermissions")}
                aria-label={t("admin.system.roles.searchPermissions")}
                className="w-56"
              />
              <Button onClick={() => void save()} loading={busy} disabled={role?.isSuperAdmin}>
                {t("admin.system.roles.saveRole")}
              </Button>
            </div>
          </div>

          <div className="grid gap-2 p-5 sm:grid-cols-2">
            {visiblePermissions.map((permission) => {
              const checked = selected.includes(permission.key);
              return (
                <label
                  key={permission.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                    checked ? "border-primary/50 bg-lavender/50 dark:bg-primary/10" : "border-border/70 hover:border-primary/30"
                  }`}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggle(permission.key)} disabled={role?.isSuperAdmin} className="mt-0.5 size-4 accent-[var(--color-primary,#7C3AED)]" />
                  <span>
                    <span className="block font-mono text-xs font-medium text-fg">{permission.key}</span>
                    <span className="mt-0.5 block text-xs text-muted">{locale === "ar" ? permission.descriptionAr : permission.descriptionEn}</span>
                  </span>
                </label>
              );
            })}
            {visiblePermissions.length === 0 && <p className="text-sm text-muted">{t("admin.common.noData")}</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
