import fs from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";
import { loadEnv } from "./lib/env";

loadEnv();

/**
 * Simulated robot device loop (development only — clearly labelled as SIMULATION).
 *
 * It speaks the exact same authenticated HTTPS protocol an ESP32 firmware would:
 *   X-Device-Id / X-Device-Timestamp / X-Device-Signature
 *   signature = hex(HMAC-SHA256(secret, `${timestamp}.${rawBody}`))   ← see src/server/auth/device-auth.ts
 *
 * What it does each tick:
 *   1. POST /api/devices/telemetry  (battery drain/charge, speed, obstacle distance)
 *   2. POST /api/devices/commands   (poll for actionable commands)
 *   3. POST /api/devices/commands/ack (ACK → EXECUTING → COMPLETED/FAILED)
 *   4. Occasionally POST /api/devices/events (obstacle detected, scan started, …)
 *
 * Usage:
 *   npm run sim:robot                        # loop every 3 s against http://localhost:3000
 *   npm run sim:robot -- --once              # single tick
 *   npm run sim:robot -- --interval 1000     # faster tick
 *   npm run sim:robot -- --device INNO-02    # only this device
 *   npm run sim:robot -- --base https://…    # remote server
 *
 * Secrets come from .data/sim-device.json, written by `npm run db:seed` (git-ignored).
 */

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

const BASE_URL = (flag("base") ?? process.env.DEVICE_SIM_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const INTERVAL_MS = Number(flag("interval") ?? 3_000);
const ONLY_DEVICE = flag("device");
const ONCE = args.includes("--once");

type SimDevice = { deviceId: string; secret: string; battery: number; speed: number; obstacle: number };

function loadSecrets(): Record<string, string> {
  const file = path.join(process.cwd(), ".data", "sim-device.json");
  if (!fs.existsSync(file)) {
    console.error("[simulator] .data/sim-device.json not found. Run `npm run db:seed` first (development only).");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string>;
}

/** Mirrors signDevicePayload() in src/server/auth/device-auth.ts — same algorithm, no server imports. */
function sign(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

async function post(device: SimDevice, route: string, payload: unknown): Promise<{ status: number; body: unknown }> {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const response = await fetch(`${BASE_URL}${route}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-device-id": device.deviceId,
      "x-device-timestamp": String(timestamp),
      "x-device-signature": sign(device.secret, timestamp, body),
    },
    body,
  });
  const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`${route} → ${response.status} ${typeof parsed.error === "string" ? parsed.error : ""}`.trim());
  }
  return { status: response.status, body: parsed };
}

type PolledCommand = { id: string; type: string; payload: Record<string, unknown> };

let tick = 0;

async function tickDevice(device: SimDevice): Promise<void> {
  tick += 1;

  // 1. Telemetry — battery drifts down while moving, recovers while idle/charging.
  device.battery = Math.min(100, Math.max(3, device.battery + (device.speed > 0 ? -0.4 : 0.3)));
  device.obstacle = Math.round(40 + Math.random() * 300);
  await post(device, "/api/devices/telemetry", {
    batteryPercent: Math.round(device.battery),
    speedPercent: Math.round(device.speed),
    obstacleDistanceCm: device.obstacle,
    mode: device.speed > 0 ? "NAVIGATION" : "ASSISTANT",
    status: device.obstacle < 60 ? "BUSY" : "ONLINE",
  });

  // 2. Poll for queued commands (STOP first, then oldest).
  const polled = await post(device, "/api/devices/commands", {});
  const commands = ((polled.body as { commands?: PolledCommand[] }).commands ?? []).slice(0, 5);
  if (commands.length === 0) return;

  for (const command of commands) {
    // 3. Acknowledge the lifecycle exactly like the firmware would.
    await post(device, "/api/devices/commands/ack", { commandId: command.id, status: "ACKNOWLEDGED" });
    await post(device, "/api/devices/commands/ack", { commandId: command.id, status: "EXECUTING" });

    if (command.type === "STOP") {
      device.speed = 0;
      await post(device, "/api/devices/commands/ack", { commandId: command.id, status: "COMPLETED", stopped: true, batteryPercent: Math.round(device.battery), deviceStatus: "IDLE" });
      console.log(`[simulator] ${device.deviceId} STOPPED (emergency)`);
      continue;
    }

    if (command.type === "SET_SPEED") {
      const requested = Number(command.payload.speedPercent ?? 40);
      device.speed = Math.max(0, Math.min(100, requested));
    } else if (command.type.startsWith("MOVE_") || command.type.startsWith("TURN_") || command.type === "NAVIGATE_TO") {
      device.speed = 35;
      await new Promise((resolve) => setTimeout(resolve, 400));
      device.speed = 0;
    }

    // Simulated failure rate keeps FAILED/EXPIRED states visible in the console (~10%).
    const failed = Math.random() < 0.1;
    await post(device, "/api/devices/commands/ack", {
      commandId: command.id,
      status: failed ? "FAILED" : "COMPLETED",
      ...(failed ? { failureReason: "Simulated motor timeout" } : {}),
      batteryPercent: Math.round(device.battery),
      deviceStatus: failed ? "ERROR" : "IDLE",
    });
    console.log(`[simulator] ${device.deviceId} ${command.type} → ${failed ? "FAILED" : "COMPLETED"}`);
  }

  // 4. Occasional free-form events (clearly marked simulated server-side).
  if (tick % 4 === 0) {
    await post(device, "/api/devices/events", {
      type: device.obstacle < 60 ? "OBSTACLE_DETECTED" : "HEARTBEAT",
      message: device.obstacle < 60 ? "Obstacle within 60 cm — slowed down" : "Simulated device heartbeat",
      payload: { obstacleDistanceCm: device.obstacle },
    });
  }
}

async function main() {
  const secrets = loadSecrets();
  const devices: SimDevice[] = Object.entries(secrets)
    .filter(([deviceId]) => !ONLY_DEVICE || deviceId === ONLY_DEVICE)
    .map(([deviceId, secret]) => ({ deviceId, secret, battery: 60 + Math.random() * 30, speed: 0, obstacle: 200 }));

  if (devices.length === 0) {
    console.error(`[simulator] no device named "${ONLY_DEVICE}" in .data/sim-device.json`);
    process.exit(1);
  }

  console.log(`[simulator] SIMULATION ONLY — fake telemetry for ${devices.map((d) => d.deviceId).join(", ")}`);
  console.log(`[simulator] base=${BASE_URL} interval=${INTERVAL_MS}ms${ONCE ? " (single tick)" : ""}`);

  do {
    for (const device of devices) {
      try {
        await tickDevice(device);
      } catch (error) {
        console.error(`[simulator] ${device.deviceId} tick failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    if (!ONCE) await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  } while (!ONCE);

  if (ONCE) console.log("[simulator] single tick complete");
  process.exit(0);
}

void main();
