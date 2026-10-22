import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { ApiError } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { campusLocations, navigationDestinations, navigationRoutes, robotCommands, robotDevices } from "@/server/db/schema";
import type { CommandStatus, CommandType } from "@/server/db/schema/common";
import type { CommandAckInput, CreateCommandInput } from "@/lib/validation/commands";
import { parseCommandPayload } from "@/lib/validation/commands";
import { audit } from "./audit";
import { getDevice, recordDeviceEvent, recordTelemetry } from "./devices";
import { getSettings } from "./settings";

export type CommandActor = { userId?: string | null; service?: string | null; label: string };

export type CommandRecord = typeof robotCommands.$inferSelect;

/** Commands that move the robot — they require an explicit manual-control acknowledgement. */
const MOVEMENT_TYPES: ReadonlySet<CommandType> = new Set<CommandType>([
  "MOVE_FORWARD",
  "MOVE_BACKWARD",
  "TURN_LEFT",
  "TURN_RIGHT",
  "SET_SPEED",
]);

/** How long a simulated command stays in EXECUTING before the simulator resolves it. */
const SIMULATED_EXECUTION_MS = 8_000;

/** Short-window duplicate protection so a double-tapped button never queues twice. */
function dedupeKeyFor(deviceId: string, type: CommandType, payload: unknown): string {
  const body = JSON.stringify(payload ?? {});
  const hash = createHash("sha256").update(`${deviceId}|${type}|${body}`).digest("hex").slice(0, 32);
  return `${hash}:${Math.floor(Date.now() / 5_000)}`;
}

/** Marks timed-out commands as EXPIRED. Called opportunistically on queue reads/writes. */
export async function expireStaleCommands(deviceId?: string): Promise<number> {
  const filters = [inArray(robotCommands.status, ["PENDING", "SENT"]), lt(robotCommands.expiresAt, new Date())];
  if (deviceId) filters.push(eq(robotCommands.deviceId, deviceId));
  // RETURNING works on both Neon (Postgres) and the embedded PGlite dev/test database,
  // giving an accurate count of commands that were actually expired.
  const expired = await db
    .update(robotCommands)
    .set({ status: "EXPIRED" satisfies CommandStatus, failureReason: "Expired before the device acknowledged it", updatedAt: new Date() })
    .where(and(...filters))
    .returning({ id: robotCommands.id });
  return expired.length;
}

/**
 * Creates a validated command.
 *
 * Safety rules enforced here (never by the AI model):
 *  - payload is validated per command type,
 *  - movement requires manual-mode acknowledgement and an online device,
 *  - navigation requires a real, active, navigable destination (+ confirmation),
 *  - STOP is emergency priority: it bypasses mode/offline checks and cancels queued movement,
 *  - commands expire, are deduplicated, and every issuance is audited.
 */
export async function createCommand(input: CreateCommandInput, actor: CommandActor): Promise<{ command: CommandRecord; simulated: boolean; duplicate: boolean }> {
  const device = await getDevice(input.deviceId);
  const settings = await getSettings();

  const parsed = parseCommandPayload(input.type, input.payload);
  if (!parsed.ok) throw new ApiError(400, parsed.error, "COMMAND_PAYLOAD_INVALID");
  const payload = parsed.payload as Record<string, unknown>;
  const isEmergencyStop = input.type === "STOP";

  await expireStaleCommands(device.deviceId);

  if (!isEmergencyStop) {
    if (!device.active) throw new ApiError(409, "This robot is deactivated.", "DEVICE_INACTIVE");
    if (device.status === "OFFLINE") {
      throw new ApiError(409, "Robot is disconnected — movement controls are disabled.", "DEVICE_OFFLINE");
    }
    if (device.status === "MAINTENANCE") {
      throw new ApiError(409, "Robot is in maintenance mode.", "DEVICE_MAINTENANCE");
    }
    if (MOVEMENT_TYPES.has(input.type) && !input.manualModeAcknowledged) {
      throw new ApiError(428, "Confirm manual control mode before sending movement commands.", "MANUAL_MODE_REQUIRED");
    }

    if (input.type === "NAVIGATE_TO") {
      const destinationKey = String(payload.destinationKey ?? "");
      const [destination] = await db
        .select({
          id: navigationDestinations.id,
          key: navigationDestinations.key,
          requiresConfirmation: navigationDestinations.requiresConfirmation,
          active: navigationDestinations.active,
          locationId: navigationDestinations.locationId,
          navigable: campusLocations.navigable,
          published: campusLocations.published,
        })
        .from(navigationDestinations)
        .leftJoin(campusLocations, eq(navigationDestinations.locationId, campusLocations.id))
        .where(eq(navigationDestinations.key, destinationKey))
        .limit(1);

      if (!destination || !destination.active) {
        throw new ApiError(400, "Unknown navigation destination.", "INVALID_DESTINATION");
      }
      if (destination.locationId && (!destination.published || !destination.navigable)) {
        throw new ApiError(409, "This destination is not available for robot navigation.", "NAVIGATION_UNAVAILABLE");
      }
      const needsConfirmation = settings.requireNavigationConfirmation && destination.requiresConfirmation;
      if (needsConfirmation && !input.confirmNavigation) {
        throw new ApiError(428, "Navigation requires explicit confirmation.", "CONFIRMATION_REQUIRED");
      }
      payload.destinationKey = destination.key;
      payload.destinationId = destination.id;
      payload.confirmed = !needsConfirmation || input.confirmNavigation;
    }

    if (input.type === "RETURN_TO_HOME" && settings.requireNavigationConfirmation && !input.confirmNavigation) {
      throw new ApiError(428, "Returning home requires explicit confirmation.", "CONFIRMATION_REQUIRED");
    }

    if (input.type === "SET_SPEED") {
      const speed = Number(payload.speedPercent ?? 0);
      if (speed > device.maxSpeedPercent) {
        throw new ApiError(400, `Speed exceeds the configured limit of ${device.maxSpeedPercent}%.`, "SPEED_LIMIT_EXCEEDED");
      }
    }
  }

  const dedupeKey = dedupeKeyFor(device.deviceId, input.type, payload);
  const [existing] = await db
    .select()
    .from(robotCommands)
    .where(and(eq(robotCommands.deviceId, device.deviceId), eq(robotCommands.dedupeKey, dedupeKey)))
    .limit(1);
  if (existing && ["PENDING", "SENT", "ACKNOWLEDGED", "EXECUTING"].includes(existing.status)) {
    return { command: existing, simulated: device.simulated, duplicate: true };
  }

  const id = randomUUID();
  const isEmergency = isEmergencyStop;

  const command = await db.transaction(async (tx) => {
    if (isEmergency) {
      // Emergency priority: drop queued movement so nothing is executed after the stop.
      await tx
        .update(robotCommands)
        .set({ status: "CANCELLED" satisfies CommandStatus, failureReason: "Superseded by emergency stop", updatedAt: new Date() })
        .where(
          and(
            eq(robotCommands.deviceId, device.deviceId),
            inArray(robotCommands.status, ["PENDING", "SENT"]),
            sql`${robotCommands.type} <> 'STOP'`,
          ),
        );
    }
    const [row] = await tx
      .insert(robotCommands)
      .values({
        id,
        deviceId: device.deviceId,
        type: input.type,
        payload,
        status: "PENDING",
        priority: isEmergency ? "EMERGENCY" : "NORMAL",
        issuedByUserId: actor.userId ?? null,
        issuedByService: actor.service ?? null,
        dedupeKey,
        expiresAt: new Date(Date.now() + input.ttlSeconds * 1000),
      })
      .returning();
    if (!row) throw new ApiError(500, "Command could not be created.", "COMMAND_CREATE_FAILED");
    return row;
  });

  await audit({
    actorUserId: actor.userId ?? null,
    actorLabel: actor.label,
    action: isEmergency ? "command.emergency_stop" : "command.created",
    targetType: "command",
    targetId: command.id,
    metadata: { deviceId: device.deviceId, type: input.type, simulated: device.simulated },
  });

  let simulated = device.simulated;
  if (device.simulated) {
    simulated = true;
    await executeSimulatedCommand(command);
  }
  const [fresh] = await db.select().from(robotCommands).where(eq(robotCommands.id, id)).limit(1);
  return { command: fresh ?? command, simulated, duplicate: false };
}

/**
 * Deterministic simulator for development: a simulated device acknowledges and applies the
 * command locally. Every resulting event keeps simulated = true so the UI can label it.
 */
export async function executeSimulatedCommand(command: CommandRecord): Promise<void> {
  const device = await getDevice(command.deviceId);
  if (!device.simulated) return;
  const now = new Date();

  switch (command.type) {
    case "STOP": {
      await db
        .update(robotCommands)
        .set({ status: "COMPLETED", ackedAt: now, completedAt: now, updatedAt: now, payload: { ...(command.payload as object), verifiedStop: true } })
        .where(eq(robotCommands.id, command.id));
      await db
        .update(robotDevices)
        .set({ status: "IDLE", currentDestinationId: null, lastSeenAt: now, updatedAt: now })
        .where(eq(robotDevices.deviceId, command.deviceId));
      await recordDeviceEvent(command.deviceId, "ROBOT_STOPPED", { verified: true, simulated: true, source: "simulator" }, true);
      break;
    }
    case "NAVIGATE_TO":
    case "RETURN_TO_HOME": {
      await db
        .update(robotCommands)
        .set({ status: "EXECUTING", ackedAt: now, updatedAt: now })
        .where(eq(robotCommands.id, command.id));
      await db
        .update(robotDevices)
        .set({ status: "MOVING", lastSeenAt: now, updatedAt: now, currentDestinationId: (command.payload as { destinationId?: string }).destinationId ?? null })
        .where(eq(robotDevices.deviceId, command.deviceId));
      await recordDeviceEvent(command.deviceId, "ROBOT_MOVING", { simulated: true, payload: command.payload }, true);
      break;
    }
    case "CHANGE_MODE": {
      await db
        .update(robotCommands)
        .set({ status: "COMPLETED", ackedAt: now, completedAt: now, updatedAt: now })
        .where(eq(robotCommands.id, command.id));
      await db
        .update(robotDevices)
        .set({ mode: (command.payload as { mode?: typeof device.mode }).mode ?? device.mode, lastSeenAt: now, updatedAt: now })
        .where(eq(robotDevices.deviceId, command.deviceId));
      break;
    }
    case "SET_SPEED": {
      await db
        .update(robotCommands)
        .set({ status: "COMPLETED", ackedAt: now, completedAt: now, updatedAt: now })
        .where(eq(robotCommands.id, command.id));
      await recordTelemetry(command.deviceId, { speedPercent: Number((command.payload as { speedPercent?: number }).speedPercent ?? 0) }, true);
      break;
    }
    default: {
      await db
        .update(robotCommands)
        .set({ status: "COMPLETED", ackedAt: now, completedAt: now, updatedAt: now })
        .where(eq(robotCommands.id, command.id));
      await db
        .update(robotDevices)
        .set({ status: "IDLE", lastSeenAt: now, updatedAt: now })
        .where(eq(robotDevices.deviceId, command.deviceId));
      await recordDeviceEvent(command.deviceId, "COMMAND_COMPLETED", { simulated: true, type: command.type, payload: command.payload }, true);
      break;
    }
  }
}

/**
 * Simulated robots "finish" navigating after a short delay. This runs when the queue is
 * read, avoiding background timers that a serverless platform cannot host.
 */
export async function advanceSimulatedCommands(deviceId?: string): Promise<void> {
  const filters = [eq(robotCommands.status, "EXECUTING"), lt(robotCommands.createdAt, new Date(Date.now() - SIMULATED_EXECUTION_MS))];
  if (deviceId) filters.push(eq(robotCommands.deviceId, deviceId));
  const due = await db
    .select()
    .from(robotCommands)
    .where(and(...filters))
    .limit(10);
  if (!due.length) return;

  for (const command of due) {
    const device = await db.select().from(robotDevices).where(eq(robotDevices.deviceId, command.deviceId)).limit(1);
    if (!device[0]?.simulated) continue;
    const now = new Date();
    await db.update(robotCommands).set({ status: "COMPLETED", completedAt: now, updatedAt: now }).where(eq(robotCommands.id, command.id));
    await db.update(robotDevices).set({ status: "IDLE", currentDestinationId: null, lastSeenAt: now, updatedAt: now }).where(eq(robotDevices.deviceId, command.deviceId));
    await recordDeviceEvent(command.deviceId, "DESTINATION_REACHED", { simulated: true, commandId: command.id }, true);
  }
}

/** Applies a real device's acknowledgement. The backend only records what the device reports. */
export async function acknowledgeCommand(deviceId: string, commandId: string, input: CommandAckInput) {
  const [command] = await db.select().from(robotCommands).where(eq(robotCommands.id, commandId)).limit(1);
  if (!command || command.deviceId !== deviceId) throw new ApiError(404, "Command not found for this device.", "COMMAND_NOT_FOUND");
  if (["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"].includes(command.status)) {
    throw new ApiError(409, `Command already ${command.status.toLowerCase()}.`, "COMMAND_TERMINAL");
  }

  const now = new Date();
  const terminal = input.status === "COMPLETED" || input.status === "FAILED";
  await db
    .update(robotCommands)
    .set({
      status: input.status,
      ackedAt: command.ackedAt ?? now,
      completedAt: terminal ? now : null,
      failureReason: input.failureReason ?? null,
      updatedAt: now,
    })
    .where(eq(robotCommands.id, commandId));

  if (input.deviceStatus || input.batteryPercent !== undefined || input.stopped !== undefined) {
    await db
      .update(robotDevices)
      .set({
        lastSeenAt: now,
        updatedAt: now,
        ...(input.deviceStatus ? { status: input.deviceStatus } : {}),
        ...(input.batteryPercent !== undefined ? { batteryPercent: input.batteryPercent } : {}),
        ...(input.stopped ? { currentDestinationId: null, status: "IDLE" } : {}),
      })
      .where(eq(robotDevices.deviceId, deviceId));
  }

  if (command.type === "STOP") {
    await recordDeviceEvent(
      deviceId,
      "ROBOT_STOPPED",
      // `verified` reflects a device-confirmed stop; a software-only request stays unverified.
      { verified: input.stopped === true, commandId, simulated: false },
      false,
    );
  }

  await audit({
    actorLabel: `device:${deviceId}`,
    action: `command.${input.status.toLowerCase()}`,
    targetType: "command",
    targetId: commandId,
    metadata: { deviceId, type: command.type, failureReason: input.failureReason ?? undefined },
  });

  const [fresh] = await db.select().from(robotCommands).where(eq(robotCommands.id, commandId)).limit(1);
  return fresh ?? command;
}

/** Cancels a queued command (only while it is still eligible). */
export async function cancelCommand(commandId: string, actor: CommandActor) {
  const [command] = await db.select().from(robotCommands).where(eq(robotCommands.id, commandId)).limit(1);
  if (!command) throw new ApiError(404, "Command not found.", "COMMAND_NOT_FOUND");
  if (!["PENDING", "SENT"].includes(command.status)) {
    throw new ApiError(409, `A ${command.status.toLowerCase()} command cannot be cancelled.`, "COMMAND_NOT_CANCELLABLE");
  }
  await db
    .update(robotCommands)
    .set({ status: "CANCELLED", failureReason: `Cancelled by ${actor.label}`, updatedAt: new Date() })
    .where(eq(robotCommands.id, commandId));
  await audit({ actorUserId: actor.userId ?? null, actorLabel: actor.label, action: "command.cancelled", targetType: "command", targetId: commandId });
  const [fresh] = await db.select().from(robotCommands).where(eq(robotCommands.id, commandId)).limit(1);
  return fresh ?? command;
}

export type CommandRow = CommandRecord & { displayName: string; simulated: boolean; deviceStatus: string };

export async function listCommands(filter?: { deviceId?: string; status?: CommandStatus; limit?: number }) {
  await expireStaleCommands(filter?.deviceId);
  await advanceSimulatedCommands(filter?.deviceId);
  const filters = [];
  if (filter?.deviceId) filters.push(eq(robotCommands.deviceId, filter.deviceId));
  if (filter?.status) filters.push(eq(robotCommands.status, filter.status));
  const where = filters.length ? and(...filters) : undefined;
  return db
    .select({
      id: robotCommands.id,
      deviceId: robotCommands.deviceId,
      type: robotCommands.type,
      payload: robotCommands.payload,
      status: robotCommands.status,
      priority: robotCommands.priority,
      failureReason: robotCommands.failureReason,
      issuedByUserId: robotCommands.issuedByUserId,
      issuedByService: robotCommands.issuedByService,
      createdAt: robotCommands.createdAt,
      expiresAt: robotCommands.expiresAt,
      ackedAt: robotCommands.ackedAt,
      completedAt: robotCommands.completedAt,
      displayName: robotDevices.displayName,
      simulated: robotDevices.simulated,
      deviceStatus: robotDevices.status,
    })
    .from(robotCommands)
    .innerJoin(robotDevices, eq(robotCommands.deviceId, robotDevices.deviceId))
    .where(where)
    .orderBy(desc(robotCommands.createdAt))
    .limit(Math.min(filter?.limit ?? 50, 200));
}

export async function getCommand(commandId: string): Promise<CommandRecord> {
  const [command] = await db.select().from(robotCommands).where(eq(robotCommands.id, commandId)).limit(1);
  if (!command) throw new ApiError(404, "Command not found.", "COMMAND_NOT_FOUND");
  return command;
}

/** Aggregated queue statistics for the admin overview (real counts, no sample data). */
export async function getCommandStats() {
  const rows = await db
    .select({ status: robotCommands.status, count: sql<number>`count(*)::int` })
    .from(robotCommands)
    .groupBy(robotCommands.status);
  const totals: Record<string, number> = {};
  let all = 0;
  for (const row of rows) {
    totals[row.status] = row.count;
    all += row.count;
  }
  return { totals, total: all, successRate: all ? Math.round((((totals.COMPLETED ?? 0) / all) * 100)) : 0 };
}

/** Human-readable routes for a destination (predefined, never autonomous). */
export async function getNavigationRoute(destinationKey: string) {
  const [destination] = await db
    .select()
    .from(navigationDestinations)
    .where(eq(navigationDestinations.key, destinationKey))
    .limit(1);
  if (!destination) return null;
  const route = await db
    .select()
    .from(navigationRoutes)
    .where(and(eq(navigationRoutes.destinationId, destination.id), eq(navigationRoutes.active, true)))
    .limit(1);
  return { destination, route: route[0] ?? null };
}
