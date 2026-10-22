# Security

This document describes the platform's threat model and the concrete controls in the code. It is written for a reviewer: every claim below points at the code that implements it.

---

## 1. Threat model (summary)

| Asset | Threat | Control |
| --- | --- | --- |
| Administrator accounts | Credential stuffing, session theft | Argon2id, HTTP-only sessions, login rate limiting, server-enforced RBAC |
| Student identity | Card UID scraping, impersonation | UID stored as HMAC hash + last-4 only; identity travels in a signed HTTP-only cookie |
| Device credentials | Theft, replay, database leak | Shown once, AES-256-GCM at rest, HMAC request signing with a ±300 s window, revocable/rotatable |
| Robot movement | Unauthorized or unsafe motion | Server-side gating (mode, offline, confirmation, speed caps), command expiry, emergency STOP priority |
| AI provider key | Browser exposure | Server-side only, never in a `NEXT_PUBLIC_*` variable |
| Uploaded media | Unsigned/malicious uploads | Server-signed Cloudinary uploads, `media.manage` required |
| Data at rest | Database leak | Password hashes (argon2id), device secrets (AES-256-GCM keyed by `DEVICE_AUTH_SECRET`), card UIDs (HMAC) |

## 2. Administrative authentication

- **Passwords** are hashed with **Argon2id** (`@node-rs/argon2`) — memory-hard, PHC-format strings. Verification of a malformed or non-argon2 hash returns `false` rather than throwing (no oracle via error differences). Policy: minimum 12 characters with at least one letter and one number.
- **Sessions** (`src/server/auth/session.ts`):
  - 32 random bytes, stored **only as a SHA-256 hash** — a database leak does not yield usable session tokens.
  - Cookie `inno_session` is `httpOnly`, `sameSite=lax`, `secure` in production, `path=/`.
  - Server-side rows carry `expiresAt` and `revokedAt`; expired sessions are purged at login.
  - `revokeAllSessions(userId)` invalidates every session — invoked on password change and account deactivation.
  - A deactivated user's live sessions stop resolving immediately (checked on every request).
- **Login rate limiting**: 8 attempts / 15 min per email+IP.

## 3. Authorization (RBAC)

- Permissions are a **central catalogue** (`src/lib/permissions.ts`, 18 dotted permissions) stored in the `permissions` table and assigned per role.
- Enforcement is **server-side on every admin route** via `requireUser(permission)`; the UI hiding a button is never the control.
- Page routes use `requireUserPage(permission)`, which redirects to `/login` (unauthenticated) or `/admin?denied=1` (unauthorized).
- **`roles.manage` is granted only to `SUPER_ADMIN`** — an `ADMIN` cannot escalate privileges, and this is covered by a test.
- `VIEWER` receives read-only permissions exclusively (asserted in tests).

## 4. CSRF and origin checks

- All state-changing admin routes call `assertSameOrigin(req)`: the `Origin` (or `Referer`) must equal `APP_BASE_URL`, else `403 BAD_ORIGIN`.
- Sessions are `SameSite=Lax`, which is the second independent layer.
- Device routes are not cookie-authenticated at all (HMAC headers), so CSRF does not apply to them.

## 5. NFC cards and student identity

- Card UIDs are stored as an **HMAC hash** plus the **last 4 digits** only (support/audit). The raw UID is never persisted and is never echoed in any response (asserted in tests).
- **Revocation is immediate**: a revoked/lost card resolves to `CARD_REVOKED` at identification time and the student is not returned.
- Revoked cards remain resolvable *as records* so the system can distinguish "revoked" from "unknown" — identification is refused at the ingestion layer, not by hiding the row.
- Scanning a card sets a **signed, HTTP-only `inno_student` cookie** carrying the identification, so identity never depends on client-held state.
- Archiving a student revokes all their cards.
- **Deduplication**: the same card from the same device within a 30 s window is flagged `duplicate`, so a retry never produces a second greeting; clients may also supply an `eventId` for cross-retry dedupe.

## 6. Device (ESP32) credentials

- Registration returns the plaintext secret **exactly once**. The database holds only AES-256-GCM ciphertext keyed by a key derived from `DEVICE_AUTH_SECRET` — leaking the database without that env var yields nothing usable.
- Every request is signed: `hex(HMAC-SHA256(secret, "{timestamp}.{rawBody}"))`. Verification is **constant-time**, and a timestamp outside **±300 s** is rejected (replay protection).
- Credentials are **revocable** and **rotatable** from the admin console; revocation takes effect on the next request.
- The public device registry contains no secrets; a separate revocable **terminal token** scopes NFC events from a paired tablet.

## 7. Robot command safety

Enforced by `src/server/services/commands.ts` — never by the AI model, the firmware, or the UI:

- Payloads are validated **per command type** (bounds on distance, duration, heading, speed).
- **Movement** requires an explicit manual-mode acknowledgement (`428 MANUAL_MODE_REQUIRED`) and an online, active, non-maintenance device (`409 DEVICE_OFFLINE` / `DEVICE_MAINTENANCE` / `DEVICE_INACTIVE`).
- **Speed** is capped by the per-device `maxSpeedPercent`.
- **Navigation** requires a real, active destination whose location is published **and** navigable, plus explicit confirmation when the destination demands it. Routes are predefined step lists — no autonomous planning.
- **Commands expire** (`ttlSeconds`, 5–600 s) if the device never acknowledges; expired commands are marked and must be discarded.
- **Emergency `STOP`** bypasses mode/offline gates, runs at `EMERGENCY` priority, and cancels every queued movement in the same transaction, so nothing can execute after a stop.
- **Duplicate taps** are deduplicated within a short window.
- The backend **only records what the device reports** — it never fabricates a completed movement, and a stop is marked `verified` only when the device confirms the physical stop.

## 8. AI provider

- The API key is server-side only and never appears in client bundles (`AI_API_KEY`, not `NEXT_PUBLIC_*`).
- **Every model output is parsed with `aiResponseSchema` before reaching the client.** Unparsable output is treated as an error, never rendered raw.
- Model output cannot issue commands directly; a validated service creates command rows.
- Answers that the knowledge base could not verify are flagged `unverified: true` rather than presented as fact.
- With no provider configured, the assistant answers only from published knowledge articles and says so.
- Assistant requests are rate limited (20/min per IP) and daily-capped (`AI_DAILY_LIMIT_PER_IP`).

## 9. Input handling

- All input goes through Zod schemas; bodies are capped at **128 KB**.
- Error responses never leak stack traces or internals (`500 INTERNAL` with a fixed message; details go to the server log).
- Uniform `handle()` wrapper means no route can accidentally return a different error shape.

## 10. Privacy

- Students **cannot sign in** — there is no student password store.
- Student personal data is limited to what the greeting needs; card UIDs are never stored in plaintext.
- Conversation retention is administrator-configurable (`conversationRetentionDays`).
- Audit logs record administrative actions with actor and target, without secret values.

## 11. Simulation honesty

- Simulator traffic is stored with `simulated = true` and is surfaced in the UI as `SIMULATED`. It is never mixed into or presented as real telemetry.
- Demo/simulation endpoints are **disabled in production** unless `ENABLE_SIMULATION=true` is set deliberately (`403 SIMULATION_DISABLED`).

## 12. Known limitations (be aware before production)

- **Rate limiters are in-memory** (`src/server/auth/rate-limit.ts`). On Vercel serverless, instances do not share state, so limits are per-instance. `createRateLimiter` is the single swap point for a shared store (Redis/Upstash). Until then, do not rely on them as a cluster-wide control.
- **Password-reset email** defaults to a console transport; configure a real transport for production or resets will only appear in logs.
- `assertSameOrigin` passes when a client sends neither `Origin` nor `Referer` (some non-browser clients); `SameSite=Lax` cookies remain the layer that protects browser sessions in that case.
- This is a single-tenant admin console; there is no account-lockout beyond rate limiting, and no 2FA. Add both if the deployment faces the public internet.
