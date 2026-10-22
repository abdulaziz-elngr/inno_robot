"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Battery, Home, Navigation, Octagon, Radio, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/provider";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

type Device = {
  deviceId: string;
  displayName: string;
  status: string;
  mode: string | null;
  batteryPercent: number | null;
  active: boolean;
  simulated: boolean;
  lastSeenAt: string | null;
  maxSpeedPercent: number;
};

type Destination = { id: string; key: string; nameEn: string; nameAr: string; requiresConfirmation: boolean; active: boolean };

type CommandRow = { id: string; type: string; status: string; createdAt: string; failureReason: string | null; priority: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { "content-type": "application/json" }, ...init });
  const body = (await res.json().catch(() => null)) as T & { error?: string };
  if (!res.ok) throw new Error(body && typeof body === "object" && "error" in body ? String((body as { error?: string }).error) : "Request failed");
  return body;
}

/**
 * Operator remote-control panel. Movement is only possible after an explicit manual-mode
 * acknowledgement, every command is server-validated, and the emergency stop is always
 * one tap away. Polling reflects *real* robot state — the UI never fakes movement.
 */
export function ControlPanel() {
  const { t, locale } = useI18n();
  const toast = useToast();

  const [devices, setDevices] = useState<Device[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [manual, setManual] = useState(false);
  const [speed, setSpeed] = useState(40);
  const [busy, setBusy] = useState<string | null>(null);
  const [commands, setCommands] = useState<CommandRow[]>([]);
  const [destinationKey, setDestinationKey] = useState("");
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const device = useMemo(() => devices.find((d) => d.deviceId === selectedId) ?? null, [devices, selectedId]);
  const isOnline = device?.status === "ONLINE" || device?.status === "IDLE" || device?.status === "MOVING" || device?.status === "BUSY";

  const refresh = useCallback(async () => {
    try {
      const [deviceRes, destRes] = await Promise.all([
        api<{ rows: Device[] }>("/api/admin/robots"),
        api<{ rows: Destination[] }>("/api/admin/navigation/destinations"),
      ]);
      setDevices(deviceRes.rows.filter((d) => d.active));
      setDestinations(destRes.rows.filter((d) => d.active));
      setSelectedId((current) => current || deviceRes.rows[0]?.deviceId || "");
    } catch (error) {
      toast({ title: t("control.disconnected"), description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  const refreshCommands = useCallback(async () => {
    if (!selectedId) return;
    try {
      const res = await api<{ rows: CommandRow[] }>(`/api/admin/commands?deviceId=${encodeURIComponent(selectedId)}&limit=8`);
      setCommands(res.rows);
    } catch {
      /* polling is best-effort */
    }
  }, [selectedId]);

  useEffect(() => {
    // The first tick is deferred to a microtask: `refresh` is async, so state only
    // changes after the fetch resolves — this keeps the effect body setState-free.
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void refresh();
      void refreshCommands();
    });
    pollRef.current = setInterval(() => {
      void refresh();
      void refreshCommands();
    }, 5_000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh, refreshCommands]);

  async function issue(type: string, payload: Record<string, unknown> = {}, opts?: { confirmNavigation?: boolean; label?: string }) {
    if (!device) return;
    const key = opts?.label ?? type;
    setBusy(key);
    try {
      await api("/api/admin/commands", {
        method: "POST",
        body: JSON.stringify({
          deviceId: device.deviceId,
          type,
          payload,
          manualModeAcknowledged: manual,
          confirmNavigation: opts?.confirmNavigation ?? false,
          ttlSeconds: 60,
        }),
      });
      await refreshCommands();
    } catch (error) {
      toast({ title: t("control.ackTimeout"), description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function emergencyStop() {
    if (!device) return;
    setBusy("STOP");
    try {
      await api("/api/admin/commands/emergency-stop", {
        method: "POST",
        body: JSON.stringify({ deviceId: device.deviceId, reason: "Operator stop from control console" }),
      });
      toast({ title: t("assistant.stopRequested"), variant: "warning" });
      await refreshCommands();
    } catch (error) {
      toast({ title: t("control.ackTimeout"), description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  const movementDisabled = !manual || !isOnline || busy !== null;

  if (loading) {
    return <div className="skeleton h-64 w-full" aria-busy="true" />;
  }

  if (devices.length === 0) {
    return (
      <div className="surface flex flex-col items-center gap-2 py-16 text-center">
        <Radio className="size-8 text-subtle" aria-hidden />
        <p className="font-medium text-fg">{t("control.selectRobot")}</p>
        <p className="text-sm text-muted">{t("public.landing.statusNotConfigured")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      {/* Device picker + status */}
      <div className="surface mb-4 p-4">
        <label htmlFor="robot-select" className="mb-1.5 block text-sm font-medium text-fg">
          {t("control.selectRobot")}
        </label>
        <Select id="robot-select" value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setManual(false); }}>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.displayName} ({d.simulated ? t("control.simulatedDevice") : d.deviceId})
            </option>
          ))}
        </Select>

        {device && (
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <Badge variant={statusVariant(device.status)}>{device.status}</Badge>
              {device.simulated && <Badge variant="simulated">{t("control.simulatedDevice")}</Badge>}
            </div>
            <div className="flex items-center justify-between text-muted">
              <span className="flex items-center gap-1.5">
                <Battery className="size-4" aria-hidden />
                {t("control.battery")}
              </span>
              <span className="font-medium text-fg">{device.batteryPercent ?? "—"}%</span>
            </div>
            <div className="flex items-center justify-between text-muted">
              <span>{t("control.speedLimit", { value: device.maxSpeedPercent })}</span>
            </div>
            {device.lastSeenAt && <p className="text-xs text-subtle">{t("control.lastSeen", { time: new Date(device.lastSeenAt).toLocaleTimeString() })}</p>}
            {!isOnline && <p className="text-xs font-medium text-error">{t("control.disconnected")}</p>}
          </div>
        )}
      </div>

      {/* Emergency stop — always visible, always first in the control order */}
      <Button variant="danger" className="mb-4 h-16 w-full text-lg font-bold" onClick={emergencyStop} loading={busy === "STOP"} disabled={busy !== null && busy !== "STOP"}>
        <Octagon className="size-6" aria-hidden />
        {t("control.stop")}
      </Button>
      <p className="mb-4 text-center text-xs text-subtle">{t("control.stopHint")}</p>

      {/* Manual mode gate */}
      <div className="surface mb-4 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-fg">{t("control.manualMode")}</span>
          <Button variant={manual ? "danger" : "secondary"} size="sm" onClick={() => setManual((v) => !v)}>
            {manual ? t("control.exitManual") : t("control.enterManual")}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">{t("control.manualWarning")}</p>
      </div>

      {/* D-pad */}
      <div className="surface mb-4 p-4">
        <div className="mx-auto grid w-48 grid-cols-3 gap-2">
          <span />
          <Button size="icon-lg" disabled={movementDisabled} loading={busy === "MOVE_FORWARD"} onPointerDown={() => void issue("MOVE_FORWARD", { durationMs: 600 }, { label: "MOVE_FORWARD" })} aria-label={t("control.forward")}>
            <ArrowUp className="size-5" aria-hidden />
          </Button>
          <span />
          <Button size="icon-lg" disabled={movementDisabled} loading={busy === "TURN_LEFT"} onPointerDown={() => void issue("TURN_LEFT", { degrees: 15 }, { label: "TURN_LEFT" })} aria-label={t("control.left")}>
            <ArrowLeft className="size-5" aria-hidden />
          </Button>
          <Button size="icon-lg" variant="outline" disabled={!manual} aria-label={t("control.stop")} onClick={emergencyStop}>
            <X className="size-5" aria-hidden />
          </Button>
          <Button size="icon-lg" disabled={movementDisabled} loading={busy === "TURN_RIGHT"} onPointerDown={() => void issue("TURN_RIGHT", { degrees: 15 }, { label: "TURN_RIGHT" })} aria-label={t("control.right")}>
            <ArrowRight className="size-5" aria-hidden />
          </Button>
          <span />
          <Button size="icon-lg" disabled={movementDisabled} loading={busy === "MOVE_BACKWARD"} onPointerDown={() => void issue("MOVE_BACKWARD", { durationMs: 600 }, { label: "MOVE_BACKWARD" })} aria-label={t("control.backward")}>
            <ArrowDown className="size-5" aria-hidden />
          </Button>
          <span />
        </div>

        <div className="mt-4">
          <label htmlFor="speed" className="flex items-center justify-between text-sm text-muted">
            <span>{t("control.speed")}</span>
            <span className="font-medium text-fg">{speed}%</span>
          </label>
          <input
            id="speed"
            type="range"
            min={10}
            max={device?.maxSpeedPercent ?? 60}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            onBlur={() => manual && void issue("SET_SPEED", { speedPercent: speed }, { label: "SET_SPEED" })}
            className="mt-1 w-full accent-[var(--color-primary)]"
            disabled={!manual || !isOnline}
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="surface mb-4 p-4">
        <label htmlFor="destination" className="mb-1.5 block text-sm font-medium text-fg">
          {t("control.destination")}
        </label>
        <Select id="destination" value={destinationKey} onChange={(e) => setDestinationKey(e.target.value)}>
          <option value="">—</option>
          {destinations.map((d) => (
            <option key={d.id} value={d.key}>
              {locale === "ar" ? d.nameAr : d.nameEn}
            </option>
          ))}
        </Select>
        <div className="mt-3 flex gap-2">
          <Button
            className="flex-1"
            disabled={!destinationKey || !isOnline || busy !== null}
            loading={busy === "NAVIGATE_TO"}
            onClick={() => {
              const dest = destinations.find((d) => d.key === destinationKey);
              void issue("NAVIGATE_TO", { destinationKey, confirmed: !dest?.requiresConfirmation }, { confirmNavigation: !dest?.requiresConfirmation, label: "NAVIGATE_TO" });
            }}
          >
            <Navigation className="size-4" aria-hidden />
            {t("control.navigate")}
          </Button>
          <Button variant="outline" disabled={!isOnline || busy !== null} loading={busy === "RETURN_TO_HOME"} onClick={() => void issue("RETURN_TO_HOME", {}, { confirmNavigation: true, label: "RETURN_TO_HOME" })}>
            <Home className="size-4" aria-hidden />
            {t("control.goHome")}
          </Button>
        </div>
      </div>

      {/* Command history */}
      <div className="surface p-4">
        <h2 className="mb-2 text-sm font-semibold text-fg">{t("control.commandHistory")}</h2>
        {commands.length === 0 ? (
          <p className="text-sm text-subtle">{t("control.queueEmpty")}</p>
        ) : (
          <ul className="space-y-1.5">
            {commands.map((command) => (
              <li key={command.id} className="flex items-center justify-between gap-2 text-sm">
                <span className={cn("font-mono text-xs", command.priority === "EMERGENCY" ? "text-error" : "text-muted")}>{command.type}</span>
                <Badge variant={statusVariant(command.status)}>{command.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
