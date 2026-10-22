import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { ApiError } from "@/server/auth/guard";
import { encryptDeviceSecret, fingerprintDeviceSecret } from "@/server/auth/device-auth";
import { db, type Executor } from "@/server/db/client";
import { deviceCredentials, deviceEvents, robotCommands, robotDevices, robotTelemetry } from "@/server/db/schema";
import type { DeviceStatus } from "@/server/db/schema/common";
import type { RegisterDeviceInput, UpdateDeviceInput } from "@/lib/validation/admin";
import type { telemetrySchema } from "@/lib/validation/commands";
import type { z } from "zod";
import { audit } from "./audit";

export type DeviceRecord = typeof robotDevices.$inferSelect;
export type TelemetryInputData = z.infer<typeof telemetrySchema>;

/** Seconds after which a device without telemetry/heartbeats is considered disconnected. */
export const ONLINE_THRESHOLD_SECONDS = 45;

export function isOnline(device: Pick<DeviceRecord, "status" | "lastSeenAt">, thresholdSeconds = ONLINE_THRESHOLD_SECONDS): boolean {
  if (device.status === "OFFLINE") return false;
  if (!device.lastSeenAt) return false;
  return Date.now() - new Date(device.lastSeenAt).getTime() < thresholdSeconds * 1000;
}

export async function listDevices(filter?: { q?: string; status?: DeviceStatus; active?: boolean }) {
  const filters = [];
  if (filter?.q) filters.push(ilike(robotDevices.displayName, `%${filter.q}%`));
  if (filter?.status) filters.push(eq(robotDevices.status, filter.status));
  if (filter?.active !== undefined) filters.push(eq(robotDevices.active, filter.active));
  const where = filters.length ? and(...filters) : undefined;
  return db
    .select({
      deviceId: robotDevices.deviceId,
      displayName: robotDevices.displayName,
      status: robotDevices.status,
      mode: robotDevices.mode,
      simulated: robotDevices.simulated,
      active: robotDevices.active,
      batteryPercent: robotDevices.batteryPercent,
      firmwareVersion: robotDevices.firmwareVersion,
      lastSeenAt: robotDevices.lastSeenAt,
      maxSpeedPercent: robotDevices.maxSpeedPercent,
      safetyTimeoutSeconds: robotDevices.safetyTimeoutSeconds,
      locationId: robotDevices.locationId,
      currentDestinationId: robotDevices.currentDestinationId,
      createdAt: robotDevices.createdAt,
      hasCredential: sql<number>`(select count(*)::int from device_credentials c where c.device_id = ${robotDevices.deviceId} and c.revoked_at is null)`,
      pendingCommands: sql<number>`(select count(*)::int from robot_commands k where k.device_id = ${robotDevices.deviceId} and k.status in ('PENDING','SENT','ACKNOWLEDGED','EXECUTING'))`,
    })
    .from(robotDevices)
    .where(where)
    .orderBy(desc(robotDevices.createdAt));
}

export async function getDevice(deviceId: string): Promise<DeviceRecord> {
  const [device] = await db.select().from(robotDevices).where(eq(robotDevices.deviceId, deviceId)).limit(1);
  if (!device) throw new ApiError(404, "Robot not found.", "DEVICE_NOT_FOUND");
  return device;
}

export async function getDeviceDetail(deviceId: string) {
  const device = await getDevice(deviceId);
  const [credential] = await db
    .select({ createdAt: deviceCredentials.createdAt, rotatedAt: deviceCredentials.rotatedAt, revokedAt: deviceCredentials.revokedAt, fingerprint: deviceCredentials.secretFingerprint })
    .from(deviceCredentials)
    .where(eq(deviceCredentials.deviceId, deviceId))
    .limit(1);
  const events = await listDeviceEvents(deviceId, 50);
  const telemetry = await db
    .select()
    .from(robotTelemetry)
    .where(eq(robotTelemetry.deviceId, deviceId))
    .orderBy(desc(robotTelemetry.recordedAt))
    .limit(30);
  const commands = await db
    .select()
    .from(robotCommands)
    .where(eq(robotCommands.deviceId, deviceId))
    .orderBy(desc(robotCommands.createdAt))
    .limit(30);
  return { device, credential: credential ?? null, events, telemetry, commands };
}

function generateSecret(): string {
  return randomBytes(24).toString("base64url");
}

/** Registers a device and returns its secret exactly once (it is stored only as ciphertext). */
export async function registerDevice(input: RegisterDeviceInput, actorId: string) {
  const existing = await db.select({ deviceId: robotDevices.deviceId }).from(robotDevices).where(eq(robotDevices.deviceId, input.deviceId)).limit(1);
  if (existing.length) throw new ApiError(409, "A device with this ID already exists.", "DEVICE_EXISTS");

  const secret = generateSecret();
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(robotDevices).values({
      id,
      deviceId: input.deviceId,
      displayName: input.displayName,
      locationId: input.locationId || null,
      firmwareVersion: input.firmwareVersion || null,
      simulated: input.simulated,
      maxSpeedPercent: input.maxSpeedPercent,
      safetyTimeoutSeconds: input.safetyTimeoutSeconds,
      status: "OFFLINE",
      active: true,
    });
    await tx.insert(deviceCredentials).values({
      id: randomUUID(),
      deviceId: input.deviceId,
      secretEncrypted: encryptDeviceSecret(secret),
      secretFingerprint: fingerprintDeviceSecret(secret),
    });
  });
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "device.registered", targetType: "device", targetId: input.deviceId, metadata: { simulated: input.simulated } });
  return { deviceId: input.deviceId, secret };
}

export async function rotateDeviceCredential(deviceId: string, actorId: string) {
  await getDevice(deviceId);
  const secret = generateSecret();
  const [existing] = await db.select({ id: deviceCredentials.id }).from(deviceCredentials).where(eq(deviceCredentials.deviceId, deviceId)).limit(1);
  if (existing) {
    await db
      .update(deviceCredentials)
      .set({ secretEncrypted: encryptDeviceSecret(secret), secretFingerprint: fingerprintDeviceSecret(secret), rotatedAt: new Date(), revokedAt: null })
      .where(eq(deviceCredentials.id, existing.id));
  } else {
    await db.insert(deviceCredentials).values({
      id: randomUUID(),
      deviceId,
      secretEncrypted: encryptDeviceSecret(secret),
      secretFingerprint: fingerprintDeviceSecret(secret),
    });
  }
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "device.credential_rotated", targetType: "device", targetId: deviceId });
  return { deviceId, secret };
}

export async function revokeDeviceCredential(deviceId: string, actorId: string) {
  await getDevice(deviceId);
  await db.update(deviceCredentials).set({ revokedAt: new Date() }).where(eq(deviceCredentials.deviceId, deviceId));
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "device.credential_revoked", targetType: "device", targetId: deviceId });
}

export async function updateDevice(deviceId: string, input: UpdateDeviceInput, actorId: string) {
  await getDevice(deviceId);
  await db
    .update(robotDevices)
    .set({
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.locationId !== undefined ? { locationId: input.locationId || null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.mode !== undefined ? { mode: input.mode } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.maxSpeedPercent !== undefined ? { maxSpeedPercent: input.maxSpeedPercent } : {}),
      ...(input.safetyTimeoutSeconds !== undefined ? { safetyTimeoutSeconds: input.safetyTimeoutSeconds } : {}),
      ...(input.firmwareVersion !== undefined ? { firmwareVersion: input.firmwareVersion || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(robotDevices.deviceId, deviceId));
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "device.updated", targetType: "device", targetId: deviceId, metadata: { fields: Object.keys(input) } });
}

/** Applies a telemetry sample from a device (or the simulator) and refreshes last-seen. */
export async function recordTelemetry(deviceId: string, input: TelemetryInputData, simulated: boolean, exec: Executor = db) {
  await exec.insert(robotTelemetry).values({
    id: randomUUID(),
    deviceId,
    batteryPercent: input.batteryPercent ?? null,
    speedPercent: input.speedPercent ?? null,
    obstacleDistanceCm: input.obstacleDistanceCm ?? null,
    mode: input.mode ?? null,
    simulated,
  });

  await exec
    .update(robotDevices)
    .set({
      lastSeenAt: new Date(),
      ...(input.batteryPercent !== undefined ? { batteryPercent: input.batteryPercent } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.mode !== undefined ? { mode: input.mode } : {}),
      ...(input.firmwareVersion !== undefined ? { firmwareVersion: input.firmwareVersion } : {}),
      updatedAt: new Date(),
    })
    .where(eq(robotDevices.deviceId, deviceId));
}

/** Heartbeat without a full telemetry sample. */
export async function touchDevice(deviceId: string, status?: DeviceStatus) {
  await db
    .update(robotDevices)
    .set({ lastSeenAt: new Date(), ...(status ? { status } : {}), updatedAt: new Date() })
    .where(eq(robotDevices.deviceId, deviceId));
}

export async function listDeviceEvents(deviceId: string, limit = 50, type?: string) {
  const filters = [eq(deviceEvents.deviceId, deviceId)];
  if (type) filters.push(eq(deviceEvents.type, type));
  return db
    .select()
    .from(deviceEvents)
    .where(and(...filters))
    .orderBy(desc(deviceEvents.createdAt))
    .limit(Math.min(limit, 200));
}

export async function recordDeviceEvent(deviceId: string, type: string, payload: Record<string, unknown>, simulated: boolean) {
  await db.insert(deviceEvents).values({ id: randomUUID(), deviceId, type, payload, simulated }).catch((error: unknown) => {
    console.error("[devices] event write failed:", error instanceof Error ? error.message : error);
  });
}

export type DeviceSnapshot = {
  deviceId: string;
  displayName: string;
  status: DeviceStatus;
  mode: DeviceRecord["mode"];
  simulated: boolean;
  active: boolean;
  online: boolean;
  batteryPercent: number | null;
  firmwareVersion: string | null;
  lastSeenAt: string | null;
  currentDestinationId: string | null;
  maxSpeedPercent: number;
  pendingCommands: number;
  lastEvent: { type: string; createdAt: string; simulated: boolean } | null;
  lastTelemetry: { batteryPercent: number | null; speedPercent: number | null; obstacleDistanceCm: number | null; simulated: boolean; recordedAt: string } | null;
};

/** Polling payload used by the dashboard/control UI (serverless-friendly, no socket required). */
export async function getDeviceSnapshots(): Promise<DeviceSnapshot[]> {
  const devices = await listDevices({ active: true });
  const ids = devices.map((d) => d.deviceId);
  const latest: Record<string, { batteryPercent: number | null; speedPercent: number | null; obstacleDistanceCm: number | null; simulated: boolean; recordedAt: Date }> = {};
  if (ids.length) {
    const rows = await db
      .select()
      .from(robotTelemetry)
      .where(inArray(robotTelemetry.deviceId, ids))
      .orderBy(desc(robotTelemetry.recordedAt))
      .limit(200);
    for (const row of rows) {
      if (!latest[row.deviceId]) {
        latest[row.deviceId] = {
          batteryPercent: row.batteryPercent,
          speedPercent: row.speedPercent,
          obstacleDistanceCm: row.obstacleDistanceCm,
          simulated: row.simulated,
          recordedAt: row.recordedAt,
        };
      }
    }
  }
  const lastEvents: Record<string, { type: string; createdAt: Date; simulated: boolean }> = {};
  if (ids.length) {
    const rows = await db.select().from(deviceEvents).where(inArray(deviceEvents.deviceId, ids)).orderBy(desc(deviceEvents.createdAt)).limit(100);
    for (const row of rows) if (!lastEvents[row.deviceId]) lastEvents[row.deviceId] = { type: row.type, createdAt: row.createdAt, simulated: row.simulated };
  }

  return devices.map((d) => ({
    deviceId: d.deviceId,
    displayName: d.displayName,
    status: d.status,
    mode: d.mode,
    simulated: d.simulated,
    active: d.active,
    online: isOnline({ status: d.status, lastSeenAt: d.lastSeenAt }),
    batteryPercent: d.batteryPercent,
    firmwareVersion: d.firmwareVersion,
    lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
    currentDestinationId: d.currentDestinationId,
    maxSpeedPercent: d.maxSpeedPercent,
    pendingCommands: d.pendingCommands,
    lastEvent: lastEvents[d.deviceId]
      ? { type: lastEvents[d.deviceId]!.type, createdAt: lastEvents[d.deviceId]!.createdAt.toISOString(), simulated: lastEvents[d.deviceId]!.simulated }
      : null,
    lastTelemetry: latest[d.deviceId]
      ? {
          batteryPercent: latest[d.deviceId]!.batteryPercent,
          speedPercent: latest[d.deviceId]!.speedPercent,
          obstacleDistanceCm: latest[d.deviceId]!.obstacleDistanceCm,
          simulated: latest[d.deviceId]!.simulated,
          recordedAt: latest[d.deviceId]!.recordedAt.toISOString(),
        }
      : null,
  }));
}
