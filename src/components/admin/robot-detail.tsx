"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Panel, PanelBody, PanelHeader, StatGrid, StatCard } from "@/components/admin/primitives";
import { adminFetch, useAsyncData } from "@/components/admin/client";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/provider";

type DeviceDetail = {
  device: {
    deviceId: string;
    displayName: string;
    status: string;
    mode: string;
    simulated: boolean;
    active: boolean;
    batteryPercent: number | null;
    firmwareVersion: string | null;
    lastSeenAt: string | null;
    maxSpeedPercent: number;
    safetyTimeoutSeconds: number;
    locationId: string | null;
  };
  credential: { createdAt: string; rotatedAt: string | null; revokedAt: string | null; fingerprint: string } | null;
  events: Array<{ id: string; type: string; payload: unknown; simulated: boolean; createdAt: string }>;
  telemetry: Array<{ batteryPercent: number | null; speedPercent: number | null; obstacleDistanceCm: number | null; mode: string | null; recordedAt: string }>;
  commands: Array<{ id: string; type: string; status: string; createdAt: string }>;
};

export function RobotDetail({ deviceId }: { deviceId: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();

  const { data, loading, error, reload } = useAsyncData(() => adminFetch<DeviceDetail>(`/api/admin/robots/${encodeURIComponent(deviceId)}`), [deviceId]);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ displayName: "", maxSpeedPercent: "60", safetyTimeoutSeconds: "10", active: true });
  const [editError, setEditError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <Panel>
        <PanelBody>
          <p className="text-sm text-error">{error ?? t("admin.common.loadError")}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push("/admin/robots")}>
            {t("admin.robots.devices.backToList")}
          </Button>
        </PanelBody>
      </Panel>
    );
  }

  const { device, credential, events, telemetry, commands } = data;
  const latest = telemetry[0];

  function openEdit() {
    setEditForm({
      displayName: device.displayName,
      maxSpeedPercent: String(device.maxSpeedPercent),
      safetyTimeoutSeconds: String(device.safetyTimeoutSeconds),
      active: device.active,
    });
    setEditError(null);
    setEditOpen(true);
  }

  async function saveEdit() {
    setBusy(true);
    setEditError(null);
    try {
      await adminFetch(`/api/admin/robots/${encodeURIComponent(deviceId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: editForm.displayName,
          maxSpeedPercent: Number(editForm.maxSpeedPercent),
          safetyTimeoutSeconds: Number(editForm.safetyTimeoutSeconds),
          active: editForm.active,
        }),
      });
      toast({ title: t("admin.common.saved"), variant: "success" });
      setEditOpen(false);
      reload();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : t("admin.common.loadError"));
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    if (!window.confirm(t("admin.robots.devices.rotateTitle"))) return;
    setBusy(true);
    try {
      const result = await adminFetch<{ secret: string }>(`/api/admin/robots/${encodeURIComponent(deviceId)}/rotate`, { method: "POST" });
      setSecret(result.secret);
      toast({ title: t("admin.robots.devices.rotated"), variant: "success" });
      reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t("admin.common.loadError"), variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!window.confirm(t("admin.robots.devices.revokeTitle"))) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/robots/${encodeURIComponent(deviceId)}/revoke`, { method: "POST" });
      toast({ title: t("admin.robots.devices.revoked"), variant: "success" });
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
        title={
          <span className="flex items-center gap-2">
            {device.displayName}
            {device.simulated && <Badge variant="simulated">{t("admin.common.simulationTag")}</Badge>}
          </span>
        }
        description={device.deviceId}
        actions={
          <>
            <Button variant="outline" onClick={() => router.push("/admin/robots")}>
              {t("admin.robots.devices.backToList")}
            </Button>
            <Button variant="outline" onClick={openEdit}>
              {t("admin.robots.devices.edit")}
            </Button>
            <Button variant="outline" onClick={() => void rotate()} loading={busy}>
              {t("admin.robots.devices.rotate")}
            </Button>
            <Button variant="danger" onClick={() => void revoke()} loading={busy}>
              {t("admin.robots.devices.revoke")}
            </Button>
          </>
        }
      />

      <StatGrid className="mb-6">
        <StatCard label={t("common.status")} value={<Badge variant={statusVariant(device.status)}>{device.status}</Badge>} hint={device.mode} />
        <StatCard label={t("admin.robots.devices.battery")} value={device.batteryPercent ?? "â€”"} hint={latest ? t("admin.robots.devices.telemetry") : undefined} tone={device.batteryPercent !== null && device.batteryPercent < 20 ? "warning" : "default"} />
        <StatCard label={t("admin.robots.devices.lastSeen")} value={device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : t("admin.robots.devices.offline")} hint={device.firmwareVersion ?? undefined} />
        <StatCard
          label={t("admin.robots.devices.maxSpeed")}
          value={`${device.maxSpeedPercent}%`}
          hint={`${t("admin.robots.devices.safetyTimeout")}: ${device.safetyTimeoutSeconds}s`}
        />
      </StatGrid>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title={t("admin.common.detail")} description={credential ? credential.fingerprint : t("admin.common.notConfigured")} />
          <Table>
            <TBody>
              <TR>
                <TD className="text-muted">{t("admin.robots.devices.deviceId")}</TD>
                <TD className="font-mono text-xs">{device.deviceId}</TD>
              </TR>
              <TR>
                <TD className="text-muted">{t("admin.robots.devices.firmware")}</TD>
                <TD>{device.firmwareVersion ?? "â€”"}</TD>
              </TR>
              <TR>
                <TD className="text-muted">{t("admin.robots.devices.simulated")}</TD>
                <TD>{device.simulated ? t("admin.common.yes") : t("admin.common.no")}</TD>
              </TR>
              <TR>
                <TD className="text-muted">{t("admin.robots.devices.active")}</TD>
                <TD>{device.active ? t("admin.common.yes") : t("admin.common.no")}</TD>
              </TR>
              <TR>
                <TD className="text-muted">{t("admin.robots.devices.rotate")}</TD>
                <TD>{credential?.rotatedAt ? new Date(credential.rotatedAt).toLocaleString() : credential ? new Date(credential.createdAt).toLocaleString() : "â€”"}</TD>
              </TR>
              <TR>
                <TD className="text-muted">{t("admin.robots.devices.revoke")}</TD>
                <TD>{credential?.revokedAt ? new Date(credential.revokedAt).toLocaleString() : t("admin.common.no")}</TD>
              </TR>
            </TBody>
          </Table>
        </Panel>

        <Panel>
          <PanelHeader title={t("admin.robots.devices.telemetry")} description={latest ? new Date(latest.recordedAt).toLocaleString() : undefined} />
          {latest ? (
            <StatGrid className="p-5">
              <StatCard label={t("admin.robots.devices.battery")} value={latest.batteryPercent ?? "â€”"} />
              <StatCard label={t("admin.robots.devices.speed")} value={latest.speedPercent ?? "â€”"} />
              <StatCard label={t("admin.robots.devices.obstacle")} value={latest.obstacleDistanceCm ?? "â€”"} />
              <StatCard label={t("admin.robots.devices.mode")} value={latest.mode ?? "â€”"} />
            </StatGrid>
          ) : (
            <PanelBody>
              <p className="text-sm text-muted">{t("admin.common.noData")}</p>
            </PanelBody>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title={t("admin.robots.devices.events")} />
          {events.length === 0 ? (
            <PanelBody>
              <p className="text-sm text-muted">{t("admin.common.noData")}</p>
            </PanelBody>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>{t("admin.robots.devices.events")}</TH>
                  <TH>{t("admin.common.createdAt")}</TH>
                </TR>
              </THead>
              <TBody>
                {events.slice(0, 12).map((event) => (
                  <TR key={event.id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{event.type}</span>
                        {event.simulated && <Badge variant="simulated">{t("admin.common.simulationTag")}</Badge>}
                      </div>
                    </TD>
                    <TD className="text-xs text-muted">{new Date(event.createdAt).toLocaleString()}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Panel>

        <Panel>
          <PanelHeader title={t("admin.robots.commands.title")} />
          {commands.length === 0 ? (
            <PanelBody>
              <p className="text-sm text-muted">{t("admin.common.noData")}</p>
            </PanelBody>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>{t("admin.robots.commands.type")}</TH>
                  <TH>{t("common.status")}</TH>
                  <TH>{t("admin.robots.commands.createdAt")}</TH>
                </TR>
              </THead>
              <TBody>
                {commands.slice(0, 12).map((command) => (
                  <TR key={command.id}>
                    <TD className="font-mono text-xs">{command.type}</TD>
                    <TD>
                      <Badge variant={statusVariant(command.status)}>{command.status}</Badge>
                    </TD>
                    <TD className="text-xs text-muted">{new Date(command.createdAt).toLocaleString()}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Panel>
      </div>

      {/* Edit settings */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={t("admin.robots.devices.edit")}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void saveEdit()} loading={busy}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.robots.devices.displayName")} required error={editError}>
            <Input value={editForm.displayName} onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })} />
          </Field>
          <Field label={t("admin.robots.devices.status")}>
            <Select value={device.status} disabled>
              <option>{device.status}</option>
            </Select>
          </Field>
          <Field label={t("admin.robots.devices.maxSpeed")}>
            <Input type="number" min={10} max={100} value={editForm.maxSpeedPercent} onChange={(e) => setEditForm({ ...editForm, maxSpeedPercent: e.target.value })} />
          </Field>
          <Field label={t("admin.robots.devices.safetyTimeout")}>
            <Input type="number" min={3} max={120} value={editForm.safetyTimeoutSeconds} onChange={(e) => setEditForm({ ...editForm, safetyTimeoutSeconds: e.target.value })} />
          </Field>
        </div>
      </Dialog>

      {/* Rotated secret */}
      <Dialog
        open={Boolean(secret)}
        onClose={() => setSecret(null)}
        title={t("admin.robots.devices.secretOnce")}
        footer={
          <Button onClick={() => setSecret(null)}>{t("common.save")}</Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">{t("admin.robots.devices.rotateBody")}</p>
          <div className="rounded-xl border border-border/70 bg-lavender/50 p-4 dark:bg-primary/10">
            <p className="break-all font-mono text-sm text-primary">{secret}</p>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
