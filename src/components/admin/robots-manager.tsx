"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader, Panel, PanelBody } from "@/components/admin/primitives";
import { adminFetch, useAsyncData } from "@/components/admin/client";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/provider";

type DeviceRow = {
  deviceId: string;
  displayName: string;
  status: string;
  mode: string;
  simulated: boolean;
  active: boolean;
  batteryPercent: number | null;
  firmwareVersion: string | null;
  lastSeenAt: string | null;
  locationId: string | null;
  pendingCommands: number;
  hasCredential: number;
};

type LocationOption = { id: string; key: string; nameEn: string; nameAr: string };

const emptyForm = {
  deviceId: "",
  displayName: "",
  locationId: "",
  firmwareVersion: "",
  simulated: true,
  maxSpeedPercent: "60",
  safetyTimeoutSeconds: "10",
};

/** Time since the device last reported, or "never". */
function lastSeenLabel(iso: string | null, locale: string, labels: { never: string; now: string; minutes: string; hours: string; days: string }): string {
  if (!iso) return labels.never;
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return labels.now;
  if (minutes < 60) return labels.minutes.replace("{n}", String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return labels.hours.replace("{n}", String(hours));
  return labels.days.replace("{n}", String(Math.floor(hours / 24)));
}

const NEVER = "\u2014";

export function RobotsManager() {
  const { t, locale } = useI18n();

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ deviceId: string; secret: string } | null>(null);

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (statusFilter) params.set("status", statusFilter);

  const { data, error, loading, reload } = useAsyncData(
    () => adminFetch<{ rows: DeviceRow[] }>(`/api/admin/robots?${params}`),
    [params.toString()],
  );
  const { data: locationsData } = useAsyncData(() => adminFetch<{ rows: LocationOption[]; total: number }>("/api/admin/locations?pageSize=100"), []);

  const rows = data?.rows ?? [];
  const locations = locationsData?.rows ?? [];
  const timeLabels = {
    never: NEVER,
    now: locale === "ar" ? "Ø§Ù„Ø¢Ù†" : "now",
    minutes: locale === "ar" ? "Ù‚Ø¨Ù„ {n} Ø¯" : "{n}m ago",
    hours: locale === "ar" ? "Ù‚Ø¨Ù„ {n} Ø³" : "{n}h ago",
    days: locale === "ar" ? "Ù‚Ø¨Ù„ {n} ÙŠ" : "{n}d ago",
  };

  async function register() {
    setBusy(true);
    setFormError(null);
    try {
      const result = await adminFetch<{ deviceId: string; secret: string }>("/api/admin/robots", {
        method: "POST",
        body: JSON.stringify({
          deviceId: form.deviceId,
          displayName: form.displayName,
          locationId: form.locationId || null,
          firmwareVersion: form.firmwareVersion,
          simulated: form.simulated,
          maxSpeedPercent: Number(form.maxSpeedPercent) || 60,
          safetyTimeoutSeconds: Number(form.safetyTimeoutSeconds) || 10,
        }),
      });
      setDialogOpen(false);
      setForm({ ...emptyForm });
      setSecret({ deviceId: result.deviceId, secret: result.secret });
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
        title={t("admin.robots.devices.title")}
        description={t("admin.robots.devices.description")}
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" aria-hidden />
            {t("admin.robots.devices.register")}
          </Button>
        }
      />

      <Panel>
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("admin.robots.devices.searchPlaceholder")}
            aria-label={t("common.search")}
            className="max-w-xs flex-1"
          />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label={t("admin.robots.devices.status")} className="w-44">
            <option value="">{t("admin.robots.devices.filterStatus")}</option>
            <option value="ONLINE">{t("admin.robots.devices.online")}</option>
            <option value="OFFLINE">{t("admin.robots.devices.offline")}</option>
            <option value="IDLE">IDLE</option>
            <option value="MOVING">MOVING</option>
            <option value="ERROR">ERROR</option>
            <option value="MAINTENANCE">MAINTENANCE</option>
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
          </PanelBody>
        ) : rows.length === 0 ? (
          <EmptyState title={t("admin.robots.devices.empty")} description={t("admin.robots.devices.emptyHint")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("admin.robots.devices.deviceId")}</TH>
                <TH>{t("admin.robots.devices.displayName")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("admin.robots.devices.mode")}</TH>
                <TH>{t("admin.robots.devices.lastSeen")}</TH>
                <TH className="text-end">{t("common.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => (
                <TR key={row.deviceId}>
                  <TD>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium">{row.deviceId}</span>
                      {row.simulated && <Badge variant="simulated">{t("admin.common.simulationTag")}</Badge>}
                    </div>
                  </TD>
                  <TD className="font-medium">{row.displayName}</TD>
                  <TD>
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  </TD>
                  <TD className="text-muted">{row.mode}</TD>
                  <TD className="text-xs text-muted">{lastSeenLabel(row.lastSeenAt, locale, timeLabels)}</TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      {row.hasCredential === 0 && <Badge variant="warning">{t("admin.common.notConfigured")}</Badge>}
                      <Link href={`/admin/robots/${encodeURIComponent(row.deviceId)}`} className="rounded-lg px-2.5 py-1 text-sm font-medium text-primary hover:bg-lavender dark:hover:bg-primary/15">
                        {t("admin.common.detail")}
                      </Link>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Panel>

      {/* Register dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t("admin.robots.devices.register")}
        description={t("admin.robots.devices.registerHint")}
        className="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void register()} loading={busy} disabled={!form.deviceId || !form.displayName}>
              {t("admin.robots.devices.register")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.robots.devices.deviceId")} required hint={t("admin.robots.devices.deviceIdHint")} error={formError}>
            <Input value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.robots.devices.displayName")} required>
            <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </Field>
          <Field label={t("admin.robots.devices.firmware")}>
            <Input value={form.firmwareVersion} onChange={(e) => setForm({ ...form, firmwareVersion: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.robots.devices.location")}>
            <Select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
              <option value="">{t("admin.robots.devices.noLocation")}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {locale === "ar" ? location.nameAr : location.nameEn}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("admin.robots.devices.maxSpeed")}>
            <Input type="number" min={10} max={100} value={form.maxSpeedPercent} onChange={(e) => setForm({ ...form, maxSpeedPercent: e.target.value })} />
          </Field>
          <Field label={t("admin.robots.devices.safetyTimeout")}>
            <Input type="number" min={3} max={120} value={form.safetyTimeoutSeconds} onChange={(e) => setForm({ ...form, safetyTimeoutSeconds: e.target.value })} />
          </Field>
          <div className="flex items-end pb-2 sm:col-span-2">
            <Switch checked={form.simulated} onChange={(checked) => setForm({ ...form, simulated: checked })} label={t("admin.robots.devices.simulated")} />
            <span className="ms-3 text-xs text-muted">{t("admin.robots.devices.simulatedHint")}</span>
          </div>
        </div>
      </Dialog>

      {/* Secret shown exactly once */}
      <Dialog
        open={Boolean(secret)}
        onClose={() => setSecret(null)}
        title={t("admin.robots.devices.secretOnce")}
        className="max-w-xl"
        footer={
          <Button onClick={() => setSecret(null)} variant="primary">
            {t("common.save")}
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">{t("admin.robots.devices.registerHint")}</p>
          <div className="rounded-xl border border-border/70 bg-lavender/50 p-4 dark:bg-primary/10">
            <p className="font-mono text-sm font-semibold text-fg">{secret?.deviceId}</p>
            <p className="mt-2 break-all font-mono text-sm text-primary">{secret?.secret}</p>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
