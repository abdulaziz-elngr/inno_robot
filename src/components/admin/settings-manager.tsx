"use client";

import { useState } from "react";
import { PageHeader, Panel, PanelBody } from "@/components/admin/primitives";
import { adminFetch, useAsyncData } from "@/components/admin/client";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/provider";

type Settings = {
  appName: string;
  taglineEn: string;
  taglineAr: string;
  defaultLocale: "ar" | "en";
  defaultTheme: "light" | "dark" | "system";
  assistantEnabled: boolean;
  guestModeEnabled: boolean;
  conversationRetentionDays: number;
  voiceEnabled: boolean;
  requireNavigationConfirmation: boolean;
  emergencyStopEnabled: boolean;
};

/** Boolean settings rendered as switches (keys only — no runtime values needed). */
type BooleanSettings = {
  assistantEnabled: true;
  guestModeEnabled: true;
  voiceEnabled: true;
  requireNavigationConfirmation: true;
  emergencyStopEnabled: true;
};
type BooleanSettingKey = keyof BooleanSettings;

export function SettingsManager() {
  const { t } = useI18n();
  const toast = useToast();
  const { data, loading, error } = useAsyncData(() => adminFetch<Settings>("/api/admin/settings"), []);

  const [form, setForm] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const value = form ?? data;

  function update<K extends keyof Settings>(key: K, next: Settings[K]) {
    setForm({ ...(value as Settings), [key]: next });
  }

  function updateBoolean(key: BooleanSettingKey, next: boolean) {
    setForm({ ...(value as Settings), [key]: next });
  }

  async function save() {
    if (!value) return;
    setBusy(true);
    setSaveError(null);
    try {
      await adminFetch("/api/admin/settings", { method: "PUT", body: JSON.stringify(value) });
      toast({ title: t("admin.system.settings.saved"), variant: "success" });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t("admin.common.loadError"));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !value) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-96 w-full" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t("admin.system.settings.title")}
        description={t("admin.system.settings.description")}
        actions={
          <Button onClick={() => void save()} loading={busy}>
            {t("common.save")}
          </Button>
        }
      />

      <Panel>
        {error && (
          <PanelBody>
            <p className="text-sm text-error">{error}</p>
          </PanelBody>
        )}
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label={t("admin.system.settings.appName")} required error={saveError}>
            <Input value={value.appName} onChange={(e) => update("appName", e.target.value)} />
          </Field>
          <Field label={t("admin.system.settings.retentionDays")} hint={t("admin.system.settings.retentionHint")}>
            <Input
              type="number"
              min={1}
              max={3650}
              value={String(value.conversationRetentionDays)}
              onChange={(e) => update("conversationRetentionDays", Number(e.target.value) || 90)}
            />
          </Field>
          <Field label={t("admin.system.settings.taglineEn")}>
            <Input value={value.taglineEn} onChange={(e) => update("taglineEn", e.target.value)} dir="ltr" />
          </Field>
          <Field label={t("admin.system.settings.taglineAr")}>
            <Input value={value.taglineAr} onChange={(e) => update("taglineAr", e.target.value)} dir="rtl" />
          </Field>
          <Field label={t("admin.system.settings.defaultLocale")}>
            <Select value={value.defaultLocale} onChange={(e) => update("defaultLocale", e.target.value as Settings["defaultLocale"])}>
              <option value="ar">{t("admin.content.knowledge.langAr")}</option>
              <option value="en">{t("admin.content.knowledge.langEn")}</option>
            </Select>
          </Field>
          <Field label={t("admin.system.settings.defaultTheme")}>
            <Select value={value.defaultTheme} onChange={(e) => update("defaultTheme", e.target.value as Settings["defaultTheme"])}>
              <option value="light">{t("admin.system.settings.themeLight")}</option>
              <option value="dark">{t("admin.system.settings.themeDark")}</option>
              <option value="system">{t("admin.system.settings.themeSystem")}</option>
            </Select>
          </Field>

          <div className="space-y-4 border-t border-border/70 pt-5 sm:col-span-2">
            {(
              [
                ["assistantEnabled", t("admin.system.settings.assistantEnabled")],
                ["guestModeEnabled", t("admin.system.settings.guestModeEnabled")],
                ["voiceEnabled", t("admin.system.settings.voiceEnabled")],
                ["requireNavigationConfirmation", t("admin.system.settings.requireNavigationConfirmation")],
                ["emergencyStopEnabled", t("admin.system.settings.emergencyStopEnabled")],
              ] as Array<[keyof BooleanSettings, string]>
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <span className="text-sm text-fg">{label}</span>
                <Switch checked={Boolean(value[key])} onChange={(checked) => updateBoolean(key, checked)} label={label} />
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}
