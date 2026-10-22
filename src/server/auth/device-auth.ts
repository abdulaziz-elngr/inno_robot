import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { deviceCredentials, robotDevices } from "@/server/db/schema";
import { ApiError } from "./guard";

/** Clock skew tolerated between the ESP32 and the server (seconds). */
const TIMESTAMP_TOLERANCE_SECONDS = 300;

function pepper(): Buffer {
  const secret = process.env.DEVICE_AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("DEVICE_AUTH_SECRET is required in production to protect device credentials.");
  }
  return createHash("sha256").update(secret ?? "inno-robot-devices-local-only").digest();
}

/**
 * AES-256-GCM encryption at rest for device secrets.
 * The database stores only ciphertext: a database leak without DEVICE_AUTH_SECRET never
 * yields a usable device credential, while the server can still verify HMAC signatures.
 */
export function encryptDeviceSecret(secret: string): string {
  const key = pepper();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptDeviceSecret(stored: string): string | null {
  try {
    const [version, ivB64, tagB64, dataB64] = stored.split(":");
    if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) return null;
    const decipher = createDecipheriv("aes-256-gcm", pepper(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Non-reversible fingerprint of a secret, for rotation bookkeeping and support checks. */
export function fingerprintDeviceSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex").slice(0, 32);
}

/** The exact signature both the firmware and the simulator must compute. */
export function signDevicePayload(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export type DevicePrincipal = {
  deviceId: string;
  displayName: string;
  simulated: boolean;
  active: boolean;
};

/**
 * Authenticates an ESP32 (or simulator) request. Required headers:
 *   X-Device-Id:        registered device id
 *   X-Device-Timestamp: unix seconds
 *   X-Device-Signature: hex HMAC-SHA256(deviceSecret, `${timestamp}.${rawBody}`)
 *
 * Device secrets never appear in frontend code and are never returned by any API after
 * the single registration/rotation response.
 */
export async function verifyDeviceRequest(req: Request, rawBody: string): Promise<DevicePrincipal> {
  const deviceId = req.headers.get("x-device-id");
  const timestampHeader = req.headers.get("x-device-timestamp");
  const signature = req.headers.get("x-device-signature");

  if (!deviceId || !timestampHeader || !signature) {
    throw new ApiError(401, "Missing device authentication headers.", "DEVICE_AUTH_MISSING");
  }
  const timestamp = Number(timestampHeader);
  if (!Number.isInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > TIMESTAMP_TOLERANCE_SECONDS) {
    throw new ApiError(401, "Device timestamp outside the accepted window.", "DEVICE_TIMESTAMP_INVALID");
  }

  const [device] = await db
    .select({
      deviceId: robotDevices.deviceId,
      displayName: robotDevices.displayName,
      simulated: robotDevices.simulated,
      active: robotDevices.active,
      secretEncrypted: deviceCredentials.secretEncrypted,
      revokedAt: deviceCredentials.revokedAt,
    })
    .from(robotDevices)
    .leftJoin(deviceCredentials, eq(deviceCredentials.deviceId, robotDevices.deviceId))
    .where(eq(robotDevices.deviceId, deviceId))
    .limit(1);

  if (!device || !device.secretEncrypted) throw new ApiError(401, "Unknown device.", "DEVICE_UNKNOWN");
  if (device.revokedAt) throw new ApiError(403, "Device credential revoked.", "DEVICE_REVOKED");
  if (!device.active) throw new ApiError(403, "Device is deactivated.", "DEVICE_INACTIVE");

  const secret = decryptDeviceSecret(device.secretEncrypted);
  if (!secret) throw new ApiError(401, "Device credential unreadable.", "DEVICE_CREDENTIAL_INVALID");

  const expected = signDevicePayload(secret, timestamp, rawBody);
  if (!safeEqualHex(expected, signature.toLowerCase())) {
    throw new ApiError(401, "Invalid device signature.", "DEVICE_SIGNATURE_INVALID");
  }

  return { deviceId: device.deviceId, displayName: device.displayName, simulated: device.simulated, active: device.active };
}

/** Loads public device metadata (no secrets) by device id. */
export async function loadDevice(deviceId: string): Promise<DevicePrincipal> {
  const [device] = await db
    .select({
      deviceId: robotDevices.deviceId,
      displayName: robotDevices.displayName,
      simulated: robotDevices.simulated,
      active: robotDevices.active,
    })
    .from(robotDevices)
    .where(eq(robotDevices.deviceId, deviceId))
    .limit(1);
  if (!device) throw new ApiError(404, "Device not found.", "DEVICE_NOT_FOUND");
  return device;
}
