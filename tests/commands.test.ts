import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanupTestDb, initTestDb, uid } from "./helpers/db";

// The embedded test database is shared by every describe in this file; clean it up once at the end.
afterAll(cleanupTestDb);

/**
 * Command safety rules. These are enforced by the backend service — never by the AI
 * model and never by the UI:
 *  - payload is validated per command type,
 *  - movement requires manual-mode acknowledgement and an online, active device,
 *  - navigation requires a real, active destination (and confirmation when configured),
 *  - STOP is emergency priority: it bypasses mode/offline gates and cancels queued movement,
 *  - commands expire, dedupe, and every issuance is audited.
 *
 * Devices here are real (simulated: false) so the simulator's auto-acknowledgement
 * never masks the gating behaviour under test.
 */

const ACTOR = { userId: null, service: "tests", label: "test-suite" };

async function makeDevice(deviceId: string, overrides?: { status?: "ONLINE" | "OFFLINE" | "MAINTENANCE"; active?: boolean; maxSpeedPercent?: number }) {
  const { db } = await import("@/server/db/client");
  const { robotDevices } = await import("@/server/db/schema");
  await db.insert(robotDevices).values({
    id: uid("dev"),
    deviceId,
    displayName: `Robot ${deviceId}`,
    status: overrides?.status ?? "ONLINE",
    active: overrides?.active ?? true,
    simulated: false,
    maxSpeedPercent: overrides?.maxSpeedPercent ?? 60,
    safetyTimeoutSeconds: 10,
  });
}

describe("parseCommandPayload", () => {
  it("accepts a well-formed payload per command type", async () => {
    const { parseCommandPayload } = await import("@/lib/validation/commands");
    expect(parseCommandPayload("MOVE_FORWARD", { distanceCm: 50 }).ok).toBe(true);
    expect(parseCommandPayload("TURN_LEFT", { degrees: 90 }).ok).toBe(true);
    expect(parseCommandPayload("STOP", { reason: "obstacle" }).ok).toBe(true);
    expect(parseCommandPayload("SET_SPEED", { speedPercent: 40 }).ok).toBe(true);
    expect(parseCommandPayload("NAVIGATE_TO", { destinationKey: "MAIN_LIBRARY" }).ok).toBe(true);
    expect(parseCommandPayload("RETURN_TO_HOME", {}).ok).toBe(true);
    expect(parseCommandPayload("CHANGE_MODE", { mode: "MANUAL" }).ok).toBe(true);
  });

  it("rejects out-of-range and unknown-type payloads", async () => {
    const { parseCommandPayload } = await import("@/lib/validation/commands");
    expect(parseCommandPayload("MOVE_FORWARD", { distanceCm: 5_000 }).ok).toBe(false);
    expect(parseCommandPayload("MOVE_FORWARD", { distanceCm: 1 }).ok).toBe(false);
    expect(parseCommandPayload("SET_SPEED", { speedPercent: 250 }).ok).toBe(false);
    expect(parseCommandPayload("TURN_RIGHT", { degrees: 400 }).ok).toBe(false);
    expect(parseCommandPayload("CHANGE_MODE", { mode: "TELEPORT" }).ok).toBe(false);
    expect(parseCommandPayload("NAVIGATE_TO", {}).ok).toBe(false);
    expect(parseCommandPayload("DROP_PASSENGER", {}).ok).toBe(false);
  });

  it("coerces numeric strings from device/admin forms", async () => {
    const { parseCommandPayload } = await import("@/lib/validation/commands");
    const parsed = parseCommandPayload("SET_SPEED", { speedPercent: "45" });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect((parsed.payload as { speedPercent: number }).speedPercent).toBe(45);
  });
});

describe("createCommand gating", () => {
  beforeAll(async () => {
    await initTestDb();
  });

  beforeEach(async () => {
    const { db } = await import("@/server/db/client");
    const { robotCommands } = await import("@/server/db/schema");
    await db.delete(robotCommands);
  });

  it("rejects movement without manual-mode acknowledgement (428)", async () => {
    await makeDevice("CMD-G1");
    const { createCommand } = await import("@/server/services/commands");
    await expect(
      createCommand({ deviceId: "CMD-G1", type: "MOVE_FORWARD", payload: { distanceCm: 50 }, manualModeAcknowledged: false, confirmNavigation: false, ttlSeconds: 60 }, ACTOR),
    ).rejects.toMatchObject({ status: 428, code: "MANUAL_MODE_REQUIRED" });
  });

  it("rejects movement toward a disconnected robot (409 DEVICE_OFFLINE)", async () => {
    await makeDevice("CMD-G2", { status: "OFFLINE" });
    const { createCommand } = await import("@/server/services/commands");
    await expect(
      createCommand({ deviceId: "CMD-G2", type: "MOVE_FORWARD", payload: {}, manualModeAcknowledged: true, confirmNavigation: false, ttlSeconds: 60 }, ACTOR),
    ).rejects.toMatchObject({ status: 409, code: "DEVICE_OFFLINE" });
  });

  it("rejects movement on a deactivated robot (409 DEVICE_INACTIVE)", async () => {
    await makeDevice("CMD-G3", { active: false });
    const { createCommand } = await import("@/server/services/commands");
    await expect(
      createCommand({ deviceId: "CMD-G3", type: "TURN_LEFT", payload: {}, manualModeAcknowledged: true, confirmNavigation: false, ttlSeconds: 60 }, ACTOR),
    ).rejects.toMatchObject({ status: 409, code: "DEVICE_INACTIVE" });
  });

  it("rejects a robot in maintenance (409 DEVICE_MAINTENANCE)", async () => {
    await makeDevice("CMD-G4", { status: "MAINTENANCE" });
    const { createCommand } = await import("@/server/services/commands");
    await expect(
      createCommand({ deviceId: "CMD-G4", type: "MOVE_FORWARD", payload: {}, manualModeAcknowledged: true, confirmNavigation: false, ttlSeconds: 60 }, ACTOR),
    ).rejects.toMatchObject({ status: 409, code: "DEVICE_MAINTENANCE" });
  });

  it("rejects speeds above the device's configured limit", async () => {
    await makeDevice("CMD-G5", { maxSpeedPercent: 40 });
    const { createCommand } = await import("@/server/services/commands");
    await expect(
      createCommand({ deviceId: "CMD-G5", type: "SET_SPEED", payload: { speedPercent: 90 }, manualModeAcknowledged: true, confirmNavigation: false, ttlSeconds: 60 }, ACTOR),
    ).rejects.toMatchObject({ code: "SPEED_LIMIT_EXCEEDED" });
    // Within the limit is fine — the command is queued (a real device acks it itself).
    const ok = await createCommand({ deviceId: "CMD-G5", type: "SET_SPEED", payload: { speedPercent: 30 }, manualModeAcknowledged: true, confirmNavigation: false, ttlSeconds: 60 }, ACTOR);
    expect(ok.duplicate).toBe(false);
    expect(ok.command.status).toBe("PENDING");
    expect(ok.simulated).toBe(false);
  });

  it("rejects navigation to an unknown destination (400 INVALID_DESTINATION)", async () => {
    await makeDevice("CMD-G6");
    const { createCommand } = await import("@/server/services/commands");
    await expect(
      createCommand({ deviceId: "CMD-G6", type: "NAVIGATE_TO", payload: { destinationKey: "NOWHERE" }, manualModeAcknowledged: false, confirmNavigation: true, ttlSeconds: 60 }, ACTOR),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_DESTINATION" });
  });

  it("rejects navigation without confirmation when the destination demands it (428)", async () => {
    await makeDevice("CMD-G7");
    const { createLocation, upsertNavigationDestination } = await import("@/server/services/locations");
    const locationId = await createLocation(
      { key: "CMD_DEST", nameEn: "Command Dest", nameAr: "وجهة الأوامر", descriptionEn: "", descriptionAr: "", directionsEn: "", directionsAr: "", buildingId: null, floorId: null, room: "", latitude: null, longitude: null, imageUrl: "", accessibilityNotes: "", published: true, navigable: true },
      uid("actor"),
    );
    await upsertNavigationDestination({ key: "CMD_DEST", locationId, nameEn: "Command Dest", nameAr: "وجهة الأوامر", requiresConfirmation: true, active: true }, uid("actor"));

    const { createCommand } = await import("@/server/services/commands");
    await expect(
      createCommand({ deviceId: "CMD-G7", type: "NAVIGATE_TO", payload: { destinationKey: "CMD_DEST" }, manualModeAcknowledged: false, confirmNavigation: false, ttlSeconds: 60 }, ACTOR),
    ).rejects.toMatchObject({ status: 428, code: "CONFIRMATION_REQUIRED" });

    // With confirmation the command is created and the destination is resolved onto the payload.
    const ok = await createCommand({ deviceId: "CMD-G7", type: "NAVIGATE_TO", payload: { destinationKey: "CMD_DEST" }, manualModeAcknowledged: false, confirmNavigation: true, ttlSeconds: 60 }, ACTOR);
    expect(ok.duplicate).toBe(false);
    expect(ok.command.payload).toMatchObject({ destinationKey: "CMD_DEST", confirmed: true });
    expect(typeof (ok.command.payload as { destinationId?: string }).destinationId).toBe("string");
  });

  it("rejects navigation to a destination whose location is not navigable (409)", async () => {
    await makeDevice("CMD-G8");
    const { createLocation, upsertNavigationDestination } = await import("@/server/services/locations");
    const locationId = await createLocation(
      { key: "CMD_STAIRS", nameEn: "Blocked Stairs", nameAr: "درج مسدود", descriptionEn: "", descriptionAr: "", directionsEn: "", directionsAr: "", buildingId: null, floorId: null, room: "", latitude: null, longitude: null, imageUrl: "", accessibilityNotes: "", published: true, navigable: false },
      uid("actor"),
    );
    await upsertNavigationDestination({ key: "CMD_STAIRS", locationId, nameEn: "Blocked Stairs", nameAr: "درج مسدود", requiresConfirmation: false, active: true }, uid("actor"));

    const { createCommand } = await import("@/server/services/commands");
    await expect(
      createCommand({ deviceId: "CMD-G8", type: "NAVIGATE_TO", payload: { destinationKey: "CMD_STAIRS" }, manualModeAcknowledged: false, confirmNavigation: true, ttlSeconds: 60 }, ACTOR),
    ).rejects.toMatchObject({ status: 409, code: "NAVIGATION_UNAVAILABLE" });
  });

  it("deduplicates a double-tapped identical command inside the window", async () => {
    await makeDevice("CMD-G9");
    const { createCommand } = await import("@/server/services/commands");
    const input = { deviceId: "CMD-G9", type: "TURN_LEFT" as const, payload: { degrees: 90 }, manualModeAcknowledged: true, confirmNavigation: false, ttlSeconds: 60 };
    const first = await createCommand(input, ACTOR);
    const second = await createCommand(input, ACTOR);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.command.id).toBe(first.command.id);
  });
});

describe("emergency stop and expiry", () => {
  beforeAll(async () => {
    await initTestDb();
  });

  it("STOP bypasses offline mode and cancels queued movement (EMERGENCY priority)", async () => {
    await makeDevice("CMD-E1", { status: "OFFLINE" });
    const { createCommand } = await import("@/server/services/commands");
    const { db } = await import("@/server/db/client");
    const { robotCommands } = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");

    // A queued movement command that never got delivered (robot went offline).
    const queued = await db
      .insert(robotCommands)
      .values({ id: uid("cmd"), deviceId: "CMD-E1", type: "MOVE_FORWARD", payload: {}, status: "PENDING", priority: "NORMAL", expiresAt: new Date(Date.now() + 60_000) })
      .returning();
    expect(queued).toHaveLength(1);

    // Emergency stop is allowed even though the robot is offline / no manual ack.
    const stop = await createCommand({ deviceId: "CMD-E1", type: "STOP", payload: { reason: "emergency" }, manualModeAcknowledged: false, confirmNavigation: false, ttlSeconds: 60 }, ACTOR);

    expect(stop.command.priority).toBe("EMERGENCY");
    expect(stop.command.type).toBe("STOP");

    // The queued movement is cancelled so nothing executes after the stop.
    const [reloaded] = await db.select().from(robotCommands).where(eq(robotCommands.id, queued[0]!.id));
    expect(reloaded?.status).toBe("CANCELLED");
    expect(reloaded?.failureReason).toMatch(/emergency stop/i);
  });

  it("expires commands the device never acknowledged", async () => {
    await makeDevice("CMD-E2");
    const { db } = await import("@/server/db/client");
    const { robotCommands } = await import("@/server/db/schema");
    const { expireStaleCommands } = await import("@/server/services/commands");
    const { eq } = await import("drizzle-orm");

    const id = uid("cmd");
    await db.insert(robotCommands).values({ id, deviceId: "CMD-E2", type: "MOVE_BACKWARD", payload: {}, status: "PENDING", priority: "NORMAL", expiresAt: new Date(Date.now() - 1_000) });

    const expired = await expireStaleCommands("CMD-E2");
    expect(expired).toBe(1);

    const [reloaded] = await db.select().from(robotCommands).where(eq(robotCommands.id, id));
    expect(reloaded?.status).toBe("EXPIRED");
    expect(reloaded?.failureReason).toBeTruthy();

    // Re-running is a no-op — an already-terminal command is untouched.
    expect(await expireStaleCommands("CMD-E2")).toBe(0);
  });

  it("records a device-verified stop only when the device confirms it", async () => {
    await makeDevice("CMD-E3");
    const { createCommand, acknowledgeCommand } = await import("@/server/services/commands");
    const { db } = await import("@/server/db/client");
    const { deviceEvents } = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");

    const stop = await createCommand({ deviceId: "CMD-E3", type: "STOP", payload: {}, manualModeAcknowledged: false, confirmNavigation: false, ttlSeconds: 60 }, ACTOR);
    const acked = await acknowledgeCommand("CMD-E3", stop.command.id, { status: "COMPLETED", stopped: true, deviceStatus: "IDLE" });

    expect(acked.status).toBe("COMPLETED");
    expect(acked.completedAt).not.toBeNull();

    const events = await db.select().from(deviceEvents).where(eq(deviceEvents.deviceId, "CMD-E3"));
    const stopEvent = events.find((e) => e.type === "ROBOT_STOPPED");
    expect(stopEvent?.payload).toMatchObject({ verified: true });
  });

  it("a queued command cannot be acknowledged twice (terminal guard)", async () => {
    await makeDevice("CMD-E4");
    const { createCommand, acknowledgeCommand } = await import("@/server/services/commands");
    const stop = await createCommand({ deviceId: "CMD-E4", type: "CHANGE_MODE", payload: { mode: "MANUAL" }, manualModeAcknowledged: true, confirmNavigation: false, ttlSeconds: 60 }, ACTOR);

    await acknowledgeCommand("CMD-E4", stop.command.id, { status: "COMPLETED" });
    await expect(acknowledgeCommand("CMD-E4", stop.command.id, { status: "COMPLETED" })).rejects.toMatchObject({ code: "COMMAND_TERMINAL" });
  });
});
