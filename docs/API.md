# API reference

All endpoints return JSON. Errors are uniform:

```json
{ "error": "Human-readable message", "code": "MACHINE_CODE" }
```

Validation failures add an `issues` array (`400 VALIDATION_FAILED`). Unhandled errors return `500 INTERNAL` with no internals leaked.

**Conventions**

- Admin routes are guarded server-side by `requireUser(permission)` — the UI never enforces access. A missing/insufficient session yields `401 UNAUTHENTICATED` / `403 FORBIDDEN`.
- Every state-changing admin route also calls `assertSameOrigin(req)` (CSRF): the `Origin`/`Referer` must match `APP_BASE_URL`, else `403 BAD_ORIGIN`.
- List endpoints return `{ rows }`, or `{ rows, total, page, pageSize }` when paginated.
- Request bodies are capped at 128 KB.

---

## Public

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | DB reachability, migration state, simulation flag |
| POST | `/api/auth/login` | `loginSchema`; rate limited 8 / 15 min per email+IP |
| POST | `/api/auth/logout` | Destroys the session |
| GET | `/api/auth/me` | Current session user or `null` |
| POST | `/api/auth/forgot` | Rate limited 5 / h per IP; email transport defaults to console |
| POST | `/api/auth/reset` | Token + new password (policy enforced) |
| POST | `/api/assistant/chat` | Assistant turn; `chatLimiter` 20 / min per IP |
| GET | `/api/assistant/status` | AI provider state (`configured`, `fallbackMode`, article count) |
| POST | `/api/assistant/identification` | Read the signed `inno_student` identification cookie |

### Demo (simulation) endpoints

`/api/assistant/demo/identify`, `/cards`, `reset` — in-browser NFC demonstration. Disabled in production unless `ENABLE_SIMULATION=true` (`403 SIMULATION_DISABLED`). All events are stored with `simulated = true`.

## Device (ESP32 / simulator)

Every route requires the signing headers `X-Device-Id`, `X-Device-Timestamp`, `X-Device-Signature` (see `docs/HARDWARE.md`).

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/devices/telemetry` | Battery/speed/obstacle/mode/status sample; refreshes `lastSeenAt` |
| POST | `/api/devices/nfc` | NFC ingestion: dedupe + card resolution + student identification |
| POST | `/api/devices/commands` | Poll actionable commands (emergency first) |
| POST | `/api/devices/commands/ack` | Command lifecycle: `ACKNOWLEDGED` → `EXECUTING` → `COMPLETED`/`FAILED` |
| POST | `/api/devices/events` | Free-form device events |

Device auth errors: `401 DEVICE_AUTH_MISSING` · `401 DEVICE_TIMESTAMP_INVALID` (±300 s) · `401 DEVICE_UNKNOWN` · `401 DEVICE_SIGNATURE_INVALID` · `403 DEVICE_REVOKED` · `403 DEVICE_INACTIVE`.

## Admin

| Path | GET | Write |
| --- | --- | --- |
| `/api/admin/analytics` | `analytics.read` | — |
| `/api/admin/buildings`, `/floors` | `locations.manage` | `locations.manage` |
| `/api/admin/cards` | — | `cards.manage` (associate / revoke / status) |
| `/api/admin/commands` | `devices.read` | `commands.issue` (or `commands.stop` for `STOP`) |
| `/api/admin/commands/emergency-stop` | — | `commands.stop` |
| `/api/admin/commands/[id]` | `devices.read` | `commands.issue` (cancel) |
| `/api/admin/conversations`, `/[id]` | `conversations.read` | — |
| `/api/admin/departments`, `/faculties` | `academics.manage` | `academics.manage` |
| `/api/admin/knowledge`, `/categories`, `/[id]`, `/[id]/status` | `knowledge.manage` | `knowledge.manage` |
| `/api/admin/locations`, `/[id]` | `locations.manage` | `locations.manage` |
| `/api/admin/media`, `/[id]` | `media.manage` | `media.manage` (sign → upload → record) |
| `/api/admin/navigation/destinations`, `/[id]`, `/routes` | `navigation.manage` | `navigation.manage` |
| `/api/admin/robots`, `/[id]` | `devices.read` | `devices.read` |
| `/api/admin/robots/[id]/rotate`, `/revoke` | — | `devices.manage` |
| `/api/admin/roles` | `roles.manage` | `roles.manage` |
| `/api/admin/security` | `security.read` | — |
| `/api/admin/settings` | `settings.manage` | `settings.manage` |
| `/api/admin/students`, `/[id]` | `students.read` | `students.write` |
| `/api/admin/users`, `/[id]` | `users.manage` | `users.manage` |

### Notable payloads

**Issue a command** `POST /api/admin/commands`

```json
{ "deviceId": "INNO-01", "type": "NAVIGATE_TO", "payload": { "destinationKey": "MAIN_LIBRARY" },
  "manualModeAcknowledged": true, "confirmNavigation": true, "ttlSeconds": 60 }
```

Returns `201`, or `200` with `duplicate: true` when an identical command is already queued (double-tap protection). Command safety errors: `400 COMMAND_PAYLOAD_INVALID` · `400 INVALID_DESTINATION` · `400 SPEED_LIMIT_EXCEEDED` · `409 DEVICE_OFFLINE` · `409 DEVICE_MAINTENANCE` · `409 DEVICE_INACTIVE` · `409 NAVIGATION_UNAVAILABLE` · `428 MANUAL_MODE_REQUIRED` · `428 CONFIRMATION_REQUIRED`.

**Media upload** `POST /api/admin/media` — two-step and server-signed:

```json
{ "action": "sign", "kind": "image", "bytes": 102400 }     // → Cloudinary signature
{ "action": "record", "kind": "image", "publicId": "…", "url": "…", "caption": "…" }
```

**Register a robot** `POST /api/admin/robots` — returns the device secret **once**; it is stored only as AES-256-GCM ciphertext and can never be read back.
