# Hardware integration (ESP32 + NFC)

The platform talks to a physical robot over **authenticated HTTPS**. There is no SDK dependency — any firmware that can compute an HMAC-SHA256 and make an HTTPS POST can drive a robot.

> A device simulator that speaks this exact protocol ships with the repo (`npm run sim:robot`). It is clearly labelled `SIMULATION` in the database and the UI, and it never impersonates real hardware.

---

## 1. Register the device

An administrator registers the robot in **Admin → Robots → Register** (permission `devices.manage`). The response contains a **device secret shown exactly once** — store it in the robot's NVS/flash, not in source control.

- `deviceId` — stable hardware identifier (letters, digits, `-`, `_`; 4–40 chars). Print it on the chassis.
- The database stores the secret only as **AES-256-GCM ciphertext** keyed by `DEVICE_AUTH_SECRET`. A database leak without that key yields no usable credential.
- Secrets are **revocable** (`/api/admin/robots/[id]/revoke`) and **rotatable** (`/rotate`). Rotation invalidates the old secret immediately.

## 2. Request signing

Every device request carries three headers:

| Header | Value |
| --- | --- |
| `X-Device-Id` | the registered device id |
| `X-Device-Timestamp` | unix time in **seconds** |
| `X-Device-Signature` | `hex(HMAC-SHA256(secret, "{timestamp}.{rawBody}"))` |

The signature covers the **raw body bytes**, so sign the exact string you send — do not re-serialize after signing.

```c
// ESP32 / Arduino-style pseudocode — see scripts/device-simulator.ts for a working reference.
char base[512];
snprintf(base, sizeof(base), "%lld.%s", timestamp_seconds, raw_json_body);

uint8_t hmac[32];
mbedtls_md_hmac_reset(&ctx);
mbedtls_md_hmac_update(&ctx, (const unsigned char*)base, strlen(base));
mbedtls_md_hmac_finish(&ctx, hmac);
// hex-encode hmac into X-Device-Signature
```

Server-side verification (`src/server/auth/device-auth.ts`):

1. Missing headers → `401 DEVICE_AUTH_MISSING`.
2. Timestamp older/newer than **±300 s** → `401 DEVICE_TIMESTAMP_INVALID` (replay protection). Keep the robot's clock synced (NTP).
3. Unknown device or no credential → `401 DEVICE_UNKNOWN`.
4. Credential revoked → `403 DEVICE_REVOKED`; device deactivated → `403 DEVICE_INACTIVE`.
5. Signature mismatch → `401 DEVICE_SIGNATURE_INVALID`. Comparison is constant-time.

NFC tablets paired to a robot use a separate revocable **terminal token** so a public-facing tablet never holds a device secret.

## 3. Endpoints the firmware calls

All are `POST`, JSON, and require the signing headers above. Responses are `200` even for rejected cards so the terminal can display a message and keep scanning.

### Telemetry — `POST /api/devices/telemetry`

```json
{ "batteryPercent": 87, "speedPercent": 30, "obstacleDistanceCm": 120, "mode": "ASSISTANT", "status": "ONLINE", "firmwareVersion": "1.2.0" }
```

All fields optional. This also refreshes the device's `lastSeenAt` (used for the online/offline threshold of 45 s).

### NFC event — `POST /api/devices/nfc`

```json
{ "cardUid": "04A1B2C3D4E5F6", "event": "CARD_DETECTED", "eventId": "optional-client-uuid" }
```

- `event`: `CARD_DETECTED` (default) · `SCAN_STARTED` · `SCAN_FAILED`.
- Supply a client `eventId` for cross-retry deduplication; the server also dedupes the same card from the same device within a 30-second window.
- The response tells you whether to greet the student, stay silent (duplicate), or show a rejection message — always bilingual (`messageEn` / `messageAr`).

```json
{
  "identification": {
    "identified": true,
    "student": { "id": "…", "firstName": "Sara", "firstNameAr": "سارة", "greetingName": "سارة", "language": "ar" },
    "reason": "OK",
    "simulated": false,
    "messageEn": "Welcome, Sara!", "messageAr": "أهلاً سارة!"
  },
  "duplicate": false,
  "eventId": "…"
}
```

Rejection reasons: `CARD_UNKNOWN`, `CARD_REVOKED`, `STUDENT_INACTIVE`. **Card UIDs are never stored** — only an HMAC hash plus the last 4 digits, and the raw UID is never echoed back.

### Command poll — `POST /api/devices/commands`

Returns this device's actionable commands (`PENDING`/`SENT`), **emergency STOP first**, then oldest-first. Empty body `{}` is fine. Stale commands are expired opportunistically here.

### Command acknowledgement — `POST /api/devices/commands/ack`

```json
{ "commandId": "…", "status": "COMPLETED", "deviceStatus": "IDLE", "batteryPercent": 86, "stopped": true, "failureReason": null }
```

Lifecycle: `ACKNOWLEDGED` → `EXECUTING` → `COMPLETED` | `FAILED`. The backend **only records what the device reports** — it never invents a completed movement. For `STOP`, send `stopped: true` only after the physical stop is confirmed; that is what marks the stop `verified` in the event log.

Commands **expire** (per-command `ttlSeconds`, 5–600) if the device never acknowledges — an expired command must be discarded, not executed.

### Events — `POST /api/devices/events`

Free-form device events (obstacle detected, scan started, error codes) for the audit/timeline view.

## 4. Safety rules enforced server-side

These are enforced by the backend service, never by firmware, the AI model, or the UI:

- **Movement** (`MOVE_FORWARD`, `MOVE_BACKWARD`, `TURN_LEFT`, `TURN_RIGHT`, `SET_SPEED`) requires an explicit manual-mode acknowledgement and an online, active, non-maintenance device (`428 MANUAL_MODE_REQUIRED`, `409 DEVICE_OFFLINE` / `DEVICE_MAINTENANCE` / `DEVICE_INACTIVE`).
- **Speed** is capped by the administrator-configured `maxSpeedPercent` (`400 SPEED_LIMIT_EXCEEDED`).
- **Navigation** (`NAVIGATE_TO`, `RETURN_TO_HOME`) requires a real, active destination whose location is published **and** navigable (`400 INVALID_DESTINATION`, `409 NAVIGATION_UNAVAILABLE`), plus explicit confirmation when configured (`428 CONFIRMATION_REQUIRED`). Routes are predefined step lists — the robot never plans autonomously.
- **Emergency `STOP`** bypasses mode/offline gates, runs at `EMERGENCY` priority, and **cancels every queued movement** so nothing executes after the stop.

## 5. MQTT (documented alternative)

The platform uses HTTPS polling by default because it needs no broker and works on serverless. If you prefer MQTT:

- Publish telemetry to `inno/devices/{deviceId}/telemetry` and NFC events to `…/nfc` with the same JSON payloads; a small bridge service (or a Vercel cron + queue reader) forwards them to the HTTPS endpoints above so **all** validation and audit stays in one place.
- Subscribe to `inno/devices/{deviceId}/commands` for the command queue and publish acks to `…/commands/ack`.
- Use TLS with client certificates (`mqtts://`, port 8883) and per-device credentials. **Do not** send the device secret over MQTT.
- The signing scheme is unchanged: if you bridge to HTTP, sign as in §2; if you stay on MQTT, authenticate at the broker instead and have the bridge call the internal service directly.

## 6. Bring-up checklist

1. Robot appears in **Admin → Robots** with status `ONLINE` after its first telemetry post.
2. A test card scan returns a greeting (or a clear rejection) at the paired terminal.
3. From **Admin → Commands**, send `CHANGE_MODE` → the device acknowledges → status `COMPLETED`.
4. Send a movement command **without** confirming manual mode → expect `428 MANUAL_MODE_REQUIRED`.
5. Press **Emergency Stop** while a movement is queued → the queued command shows `CANCELLED (Superseded by emergency stop)`.
6. Kill the firmware → the robot shows `OFFLINE` after 45 s and movement controls are disabled.
