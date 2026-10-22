import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestDb, initTestDb, uid } from "./helpers/db";

/**
 * Device authentication: ESP32s (and the simulator) authenticate every request with
 * an HMAC over `${timestamp}.${rawBody}` using a secret that is stored only as
 * AES-256-GCM ciphertext. A database leak without DEVICE_AUTH_SECRET must never
 * yield a usable credential.
 */

const DEVICE = "INNO-DA1";
const BODY = JSON.stringify({ cardUid: "04A1B2C3D4E5F6", event: "CARD_DETECTED" });

describe("device secret encryption at rest", () => {
  it("round-trips a secret and never stores plaintext", async () => {
    const { decryptDeviceSecret, encryptDeviceSecret, fingerprintDeviceSecret } = await import("@/server/auth/device-auth");
    const secret = "super-secret-device-value";

    const stored = encryptDeviceSecret(secret);
    expect(stored.startsWith("v1:")).toBe(true);
    expect(stored).not.toContain(secret);

    expect(decryptDeviceSecret(stored)).toBe(secret);
    // Every encryption uses a fresh IV.
    expect(encryptDeviceSecret(secret)).not.toBe(stored);
    // Fingerprint is a stable, non-reversible 32-hex identifier.
    expect(fingerprintDeviceSecret(secret)).toMatch(/^[0-9a-f]{32}$/);
    expect(fingerprintDeviceSecret(secret)).toBe(fingerprintDeviceSecret(secret));
    expect(fingerprintDeviceSecret(secret)).not.toContain(secret);
  });

  it("returns null for tampered or malformed ciphertext instead of throwing", async () => {
    const { decryptDeviceSecret, encryptDeviceSecret } = await import("@/server/auth/device-auth");
    const stored = encryptDeviceSecret("secret");
    const [version, iv, tag] = stored.split(":");
    const flipped = `${version}:${iv}:${tag}:${Buffer.from("tampered").toString("base64")}`;

    expect(decryptDeviceSecret(flipped)).toBeNull();
    expect(decryptDeviceSecret("not-ciphertext")).toBeNull();
    expect(decryptDeviceSecret("")).toBeNull();
  });
});

describe("device request signing", () => {
  it("signs `${timestamp}.${body}` deterministically and body/timestamp sensitively", async () => {
    const { signDevicePayload } = await import("@/server/auth/device-auth");
    const ts = 1_760_000_000;

    expect(signDevicePayload("secret", ts, BODY)).toBe(signDevicePayload("secret", ts, BODY));
    expect(signDevicePayload("secret", ts, BODY)).not.toBe(signDevicePayload("secret", ts + 1, BODY));
    expect(signDevicePayload("secret", ts, BODY)).not.toBe(signDevicePayload("secret", ts, `${BODY} `));
    expect(signDevicePayload("secret", ts, BODY)).not.toBe(signDevicePayload("other", ts, BODY));
  });
});

describe("verifyDeviceRequest", () => {
  let secret: string;

  beforeAll(async () => {
    await initTestDb();
    const { registerDevice } = await import("@/server/services/devices");
    const registered = await registerDevice(
      { deviceId: DEVICE, displayName: "Device Auth Robot", locationId: null, firmwareVersion: "1.0.0", simulated: false, maxSpeedPercent: 60, safetyTimeoutSeconds: 10 },
      uid("actor"),
    );
    secret = registered.secret;
    // Bring the device online so only the auth layer is under test.
    const { updateDevice } = await import("@/server/services/devices");
    await updateDevice(DEVICE, { status: "ONLINE" }, uid("actor"));
  });

  afterAll(cleanupTestDb);

  async function signedRequest(body: string, opts?: { timestamp?: number; signature?: string; deviceId?: string }) {
    const { signDevicePayload } = await import("@/server/auth/device-auth");
    const timestamp = opts?.timestamp ?? Math.floor(Date.now() / 1000);
    const signature = opts?.signature ?? signDevicePayload(secret, timestamp, body);
    return new Request("http://localhost/api/devices/nfc", {
      method: "POST",
      headers: {
        "x-device-id": opts?.deviceId ?? DEVICE,
        "x-device-timestamp": String(timestamp),
        "x-device-signature": signature,
        "content-type": "application/json",
      },
    });
  }

  it("authenticates a correctly signed request and returns the principal", async () => {
    const { verifyDeviceRequest } = await import("@/server/auth/device-auth");
    const principal = await verifyDeviceRequest(await signedRequest(BODY), BODY);

    expect(principal.deviceId).toBe(DEVICE);
    expect(principal.active).toBe(true);
    // The simulated flag is surfaced so the UI can label traffic honestly.
    expect(principal.simulated).toBe(false);
  });

  it("rejects a signature computed over a different body (payload tampering)", async () => {
    const { signDevicePayload } = await import("@/server/auth/device-auth");
    const { verifyDeviceRequest } = await import("@/server/auth/device-auth");
    const timestamp = Math.floor(Date.now() / 1000);
    const forged = signDevicePayload(secret, timestamp, JSON.stringify({ event: "STOP" }));

    await expect(verifyDeviceRequest(await signedRequest(BODY, { timestamp, signature: forged }), BODY)).rejects.toMatchObject({
      code: "DEVICE_SIGNATURE_INVALID",
    });
  });

  it("rejects a signature made with the wrong secret", async () => {
    const { signDevicePayload, verifyDeviceRequest } = await import("@/server/auth/device-auth");
    const timestamp = Math.floor(Date.now() / 1000);
    const forged = signDevicePayload("not-the-real-secret", timestamp, BODY);

    await expect(verifyDeviceRequest(await signedRequest(BODY, { timestamp, signature: forged }), BODY)).rejects.toMatchObject({
      code: "DEVICE_SIGNATURE_INVALID",
    });
  });

  it("rejects a timestamp outside the ±300s window (replay protection)", async () => {
    const { verifyDeviceRequest } = await import("@/server/auth/device-auth");
    const stale = Math.floor(Date.now() / 1000) - 3_600;
    const future = Math.floor(Date.now() / 1000) + 3_600;

    await expect(verifyDeviceRequest(await signedRequest(BODY, { timestamp: stale }), BODY)).rejects.toMatchObject({
      code: "DEVICE_TIMESTAMP_INVALID",
    });
    await expect(verifyDeviceRequest(await signedRequest(BODY, { timestamp: future }), BODY)).rejects.toMatchObject({
      code: "DEVICE_TIMESTAMP_INVALID",
    });
  });

  it("rejects requests with missing auth headers", async () => {
    const { verifyDeviceRequest } = await import("@/server/auth/device-auth");
    const noHeaders = new Request("http://localhost/api/devices/nfc", { method: "POST" });
    await expect(verifyDeviceRequest(noHeaders, BODY)).rejects.toMatchObject({ code: "DEVICE_AUTH_MISSING" });
  });

  it("rejects an unregistered device id", async () => {
    const { verifyDeviceRequest } = await import("@/server/auth/device-auth");
    await expect(verifyDeviceRequest(await signedRequest(BODY, { deviceId: "INNO-UNKNOWN" }), BODY)).rejects.toMatchObject({
      code: "DEVICE_UNKNOWN",
    });
  });

  it("rejects a revoked credential immediately", async () => {
    const { revokeDeviceCredential } = await import("@/server/services/devices");
    const { verifyDeviceRequest } = await import("@/server/auth/device-auth");
    await revokeDeviceCredential(DEVICE, uid("actor"));

    // The signature is valid — only the revocation stops it.
    await expect(verifyDeviceRequest(await signedRequest(BODY), BODY)).rejects.toMatchObject({ code: "DEVICE_REVOKED" });

    // Rotating the credential restores access with the new secret.
    const { rotateDeviceCredential } = await import("@/server/services/devices");
    const rotated = await rotateDeviceCredential(DEVICE, uid("actor"));
    const timestamp = Math.floor(Date.now() / 1000);
    const { signDevicePayload } = await import("@/server/auth/device-auth");
    const req = await signedRequest(BODY, { timestamp, signature: signDevicePayload(rotated.secret, timestamp, BODY) });
    await expect(verifyDeviceRequest(req, BODY)).resolves.toMatchObject({ deviceId: DEVICE });
  });

  it("rejects a deactivated device even with a valid signature", async () => {
    const { updateDevice, rotateDeviceCredential } = await import("@/server/services/devices");
    const { signDevicePayload, verifyDeviceRequest } = await import("@/server/auth/device-auth");
    const rotated = await rotateDeviceCredential(DEVICE, uid("actor"));
    secret = rotated.secret;

    await updateDevice(DEVICE, { active: false }, uid("actor"));
    await expect(verifyDeviceRequest(await signedRequest(BODY), BODY)).rejects.toMatchObject({ code: "DEVICE_INACTIVE" });

    await updateDevice(DEVICE, { active: true }, uid("actor"));
    const timestamp = Math.floor(Date.now() / 1000);
    const req = await signedRequest(BODY, { timestamp, signature: signDevicePayload(secret, timestamp, BODY) });
    await expect(verifyDeviceRequest(req, BODY)).resolves.toMatchObject({ deviceId: DEVICE });
  });
});
