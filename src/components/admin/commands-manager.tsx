"use client";

import { useState } from "react";
import { OctagonX, Plus } from "lucide-react";
import { PageHeader, Panel, PanelBody, StatGrid, StatCard } from "@/components/admin/primitives";
import { adminFetch, useAsyncData } from "@/components/admin/client";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/provider";

type CommandRow = {
  id: string;
  deviceId: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  priority: string;
  failureReason: string | null;
  issuedByUserId: string | null;
  issuedByService: string | null;
  createdAt: string;
  expiresAt: string;
  completedAt: string | null;
  displayName: string;
  simulated: boolean;
  deviceStatus: string;
};

type CommandStats = { total: number; completed: number; failed: number; pending: number; successRate: number };

const COMMAND_TYPES = ["MOVE_FORWARD", "MOVE_BACKWARD", "TURN_LEFT", "TURN_RIGHT", "STOP", "SET_SPEED", "NAVIGATE_TO", "RETURN_TO_HOME", "CHANGE_MODE"] as const;

export function CommandsManager() {
  const { t } = useI18n();
  const toast = useToast();

  const [deviceFilter, setDeviceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ deviceId: "", type: "MOVE_FORWARD", payload: "{}", ttlSeconds: "60" });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyDevice, setEmergencyDevice] = useState("");
  const [emergencyReason, setEmergencyReason] = useState("Emergency stop");

  const params = new URLSearchParams();
  if (deviceFilter) params.set("deviceId", deviceFilter);
  if (statusFilter) params.set("status", statusFilter);

  const { data, error, loading, reload } = useAsyncData(
    () => adminFetch<{ rows: CommandRow[]; stats: CommandStats }>(`/api/admin/commands?${params}`),
    [params.toString()],
  );
  const { data: devicesData } = useAsyncData(() => adminFetch<{ rows: Array<{ deviceId: string; displayName: string; simulated: boolean }> }>("/api/admin/robots"), []);

  const rows = data?.rows ?? [];
  const stats = data?.stats;
  const devices = devicesData?.rows ?? [];

  async function issue() {
    setBusy(true);
    setFormError(null);
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(form.payload || "{}") as Record<string, unknown>;
    } catch {
      setFormError("Invalid JSON payload");
      setBusy(false);
      return;
    }
    try {
      const result = await adminFetch<{ duplicate?: boolean }>("/api/admin/commands", {
        method: "POST",
        body: JSON.stringify({
          deviceId: form.deviceId,
          type: form.type,
          payload,
          manualModeAcknowledged: true,
          confirmNavigation: true,
          ttlSeconds: Number(form.ttlSeconds) || 60,
        }),
      });
      toast({ title: result.duplicate ? t("admin.robots.commands.duplicate") : t("admin.common.created"), variant: result.duplicate ? "warning" : "success" });
      setDialogOpen(false);
      reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("admin.common.loadError"));
    } finally {
      setBusy(false);
    }
  }

  async function triggerEmergency() {
    if (!emergencyDevice) return;
    setBusy(true);
    try {
      await adminFetch("/api/admin/commands/emergency-stop", {
        method: "POST",
        body: JSON.stringify({ deviceId: emergencyDevice, reason: emergencyReason }),
      });
      toast({ title: t("admin.robots.commands.emergencyTriggered"), variant: "success" });
      setEmergencyOpen(false);
      reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t("admin.common.loadError"), variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function cancel(row: CommandRow) {
    try {
      await adminFetch(`/api/admin/commands/${row.id}`, { method: "POST" });
      toast({ title: t("admin.robots.commands.cancelled2"), variant: "success" });
      reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t("admin.common.loadError"), variant: "error" });
    }
  }

  const defaultPayload: Record<string, string> = {
    MOVE_FORWARD: '{"distanceCm": 50}',
    MOVE_BACKWARD: '{"distanceCm": 30}',
    TURN_LEFT: '{"degrees": 45}',
    TURN_RIGHT: '{"degrees": 45}',
    STOP: '{"reason": "operator"}',
    SET_SPEED: '{"speedPercent": 40}',
    NAVIGATE_TO: '{"destinationKey": "MAIN_LIBRARY", "confirmed": true}',
    RETURN_TO_HOME: "{}",
    CHANGE_MODE: '{"mode": "ASSISTANT"}',
  };

  return (
    <div>
      <PageHeader
        title={t("admin.robots.commands.title")}
        description={t("admin.robots.commands.description")}
        actions={
          <>
            <Button variant="danger" onClick={() => setEmergencyOpen(true)}>
              <OctagonX className="size-4" aria-hidden />
              {t("admin.robots.commands.emergencyStop")}
            </Button>
            <Button
              onClick={() => {
                setFormError(null);
                setForm({ ...form, deviceId: devices[0]?.deviceId ?? "", payload: "{}" });
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              {t("admin.robots.commands.issue")}
            </Button>
          </>
        }
      />

      {stats && (
        <StatGrid className="mb-6">
          <StatCard label={t("admin.robots.commands.pending")} value={stats.pending} />
          <StatCard label={t("admin.robots.commands.completed")} value={stats.completed} tone="success" />
          <StatCard label={t("admin.robots.commands.failed")} value={stats.failed} tone={stats.failed > 0 ? "error" : "default"} />
          <StatCard label={t("admin.robots.commands.successRate")} value={`${stats.successRate}%`} />
        </StatGrid>
      )}

      <Panel>
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3">
          <Select value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)} aria-label={t("admin.robots.commands.device")} className="w-52">
            <option value="">{t("admin.robots.commands.allDevices")}</option>
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.deviceId}
                {device.simulated ? " Â· SIM" : ""}
              </option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label={t("admin.robots.commands.status")} className="w-44">
            <option value="">{t("admin.robots.commands.filterStatus")}</option>
            <option value="PENDING">{t("admin.robots.commands.pending")}</option>
            <option value="SENT">{t("admin.robots.commands.sent")}</option>
            <option value="COMPLETED">{t("admin.robots.commands.completed")}</option>
            <option value="FAILED">{t("admin.robots.commands.failed")}</option>
            <option value="EXPIRED">{t("admin.robots.commands.expired")}</option>
            <option value="CANCELLED">{t("admin.robots.commands.cancelled")}</option>
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
          <EmptyState title={t("admin.robots.commands.empty")} description={t("admin.robots.commands.emptyHint")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("admin.robots.commands.type")}</TH>
                <TH>{t("admin.robots.commands.device")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("admin.robots.commands.expiresAt")}</TH>
                <TH>{t("admin.robots.commands.createdAt")}</TH>
                <TH className="text-end">{t("common.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => (
                <TR key={row.id}>
                  <TD>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium">{row.type}</span>
                      {row.priority === "EMERGENCY" && <Badge variant="error">EMERGENCY</Badge>}
                      {row.simulated && <Badge variant="simulated">{t("admin.common.simulationTag")}</Badge>}
                    </div>
                  </TD>
                  <TD className="font-mono text-xs">{row.deviceId}</TD>
                  <TD>
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    {row.failureReason && <p className="mt-0.5 max-w-48 truncate text-xs text-error">{row.failureReason}</p>}
                  </TD>
                  <TD className="text-xs text-muted">{new Date(row.expiresAt).toLocaleTimeString()}</TD>
                  <TD className="text-xs text-muted">{new Date(row.createdAt).toLocaleString()}</TD>
                  <TD>
                    <div className="flex justify-end">
                      {["PENDING", "SENT", "ACKNOWLEDGED"].includes(row.status) && (
                        <Button variant="ghost" size="sm" className="text-error" onClick={() => void cancel(row)}>
                          {t("admin.robots.commands.cancel")}
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Panel>

      {/* Issue command */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t("admin.robots.commands.issue")}
        className="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void issue()} loading={busy} disabled={!form.deviceId}>
              {t("admin.robots.commands.issue")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.robots.commands.device")} required error={formError}>
            <Select value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })}>
              <option value="" disabled>
                {t("admin.common.selectPlaceholder")}
              </option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.deviceId}
                  {device.simulated ? " Â· SIM" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("admin.robots.commands.type")} required>
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value, payload: defaultPayload[e.target.value] ?? "{}" })}
            >
              {COMMAND_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("admin.robots.commands.payload")} className="sm:col-span-2">
            <Input value={form.payload} onChange={(e) => setForm({ ...form, payload: e.target.value })} dir="ltr" className="font-mono" />
          </Field>
          <Field label={t("admin.robots.commands.expiresAt")}>
            <Input type="number" min={5} max={600} value={form.ttlSeconds} onChange={(e) => setForm({ ...form, ttlSeconds: e.target.value })} />
          </Field>
        </div>
      </Dialog>

      {/* Emergency stop */}
      <Dialog
        open={emergencyOpen}
        onClose={() => setEmergencyOpen(false)}
        title={t("admin.robots.commands.emergencyTitle")}
        description={t("admin.robots.commands.emergencyBody")}
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setEmergencyOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={() => void triggerEmergency()} loading={busy} disabled={!emergencyDevice}>
              {t("admin.robots.commands.emergencyStop")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t("admin.robots.commands.device")} required>
            <Select value={emergencyDevice} onChange={(e) => setEmergencyDevice(e.target.value)}>
              <option value="" disabled>
                {t("admin.common.selectPlaceholder")}
              </option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.deviceId}
                  {device.simulated ? " Â· SIM" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("admin.robots.commands.reason")}>
            <Input value={emergencyReason} onChange={(e) => setEmergencyReason(e.target.value)} maxLength={200} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
