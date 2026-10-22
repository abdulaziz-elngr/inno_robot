# Inno Robot — Handoff Report

**Date:** 2026-10-22
**Status:** Complete and verified. All gates green.
**Repository:** `inno-robot/` (git initialized, single commit `2ac2973`, 232 files / 34,231 lines)

---

## 1. What was built

A production-shaped, full-stack AI-powered university assistant platform:

| Area | Delivered |
| --- | --- |
| Public web | Home, assistant (+ demo), campus directory & detail pages, help, privacy, terms — bilingual ar/en with correct RTL/LTR and light/dark themes |
| Auth | Login, forgot-password, reset-password; HTTP-only sessions, Argon2id, rate limiting |
| Admin console | ~22 pages: overview, students, cards, faculties, departments, locations, buildings/floors, knowledge (+categories), navigation, robots (+detail), commands, conversations (+detail), media, users, roles (permission matrix), settings, analytics, security |
| Robot | Animated SVG face with 11 event-driven states (pure reducer, sticky error/offline), voice input, NFC scan flow |
| Control | Mobile remote-control panel with polling, manual-mode gating, emergency stop |
| Devices | ESP32 management over authenticated HTTPS: telemetry, NFC ingestion, command poll/ack, events |
| Services | 15 domain service modules; 28-table Drizzle schema; SQL migrations; seed script |
| Simulator | `npm run sim:robot` — speaks the real device protocol, labelled `SIMULATION` everywhere |
| Tests | 79 tests / 7 suites on isolated embedded PGlite databases |
| Docs | README + deployment, hardware, API, security, troubleshooting |

## 2. Verification results

```
npm run lint      ✅ 0 errors, 0 warnings
npm run typecheck ✅ clean (tsc --noEmit)
npm test          ✅ 79/79 passed (7 files)
npm run build     ✅ production build, all routes emitted
```

Run these yourself after cloning. `npm run verify` additionally smoke-tests a **running** server (health, AI state, public pages, auth refusal, dev login, authenticated admin call) — it is honest about what it can and cannot check and exits non-zero on failure.

## 3. Getting started

```bash
npm install
cp .env.example .env        # fill in values (DATABASE_URL optional for local dev)
npm run db:migrate
npm run db:seed             # creates admin@inno-robot.test / InnoRobot#2026
npm run dev                 # http://localhost:3000
npm run sim:robot           # optional: simulated robot (other terminal)
```

With no `DATABASE_URL`, the app uses an embedded PGlite database under `.data/` — no external services needed.

## 4. What is real vs. simulated (read this first)

This project never fakes a capability. The boundaries are explicit:

- **Real:** all web UI, auth, RBAC, admin CRUD, database, migrations, tests, command safety logic, device authentication, NFC resolution/dedupe.
- **Simulated (and labelled `SIMULATED` in DB, API, and UI):** robot telemetry/movement produced by `scripts/device-simulator.ts`. Gated by `ENABLE_SIMULATION` — **off in production** unless explicitly enabled.
- **Not configured in this environment (clear unconfigured states, not fake success):**
  - **AI provider** — no key ⇒ assistant answers only from published knowledge articles and reports `configured: false`.
  - **Cloudinary** — no credentials ⇒ uploads refused with "Cloudinary not configured".
  - **Neon** — no credentials ⇒ embedded PGlite used; production deploy requires real Neon.
  - **Email** — password-reset transport defaults to console; configure a real transport for production.

**No physical ESP32 was available**, so hardware integration is implemented, documented (`docs/HARDWARE.md`), and exercised by the simulator which uses the identical signing scheme. Firmware validation on real hardware remains to be done.

## 5. Known limitations (deliberate, documented)

1. **Rate limiters are in-memory** (`src/server/auth/rate-limit.ts`). On Vercel serverless they are per-instance. `createRateLimiter` is the single swap point for Redis/Upstash. See `docs/SECURITY.md` §12.
2. **No 2FA / account lockout** beyond rate limiting — add if facing the public internet.
3. **Password-reset email** is console-transport by default.
4. **MQTT** is documented as an alternative (`docs/HARDWARE.md` §5) but not implemented; HTTPS polling is the shipped path and is serverless-friendly.
5. **Simulated command completion and stale-command expiry run opportunistically** on queue read/write — no background timers, which is required for serverless.

## 6. Architecture decisions worth knowing

- **IDs are app-generated UUIDs** (`text` PKs, no DB defaults) — portable across Neon and PGlite. **Every insert must supply `id`.**
- **Embedded PGlite, never SQLite** — dev fallback and test databases are real PostgreSQL.
- **Tests get one isolated PGlite DB per file** (`tests/helpers/db.ts` sets `EMBEDDED_DB_DIR`, deletes `DATABASE_URL`). `cleanupTestDb()` must be called **once per file** — sharing across `describe` blocks is intentional.
- **Device secrets are AES-256-GCM at rest** keyed by `DEVICE_AUTH_SECRET`; requests signed `HMAC-SHA256(secret, "{timestamp}.{rawBody}")` with a ±300 s window, constant-time compare.
- **Card UIDs stored as HMAC hash + last-4 only**; raw UID never stored or echoed.
- **The AI model never issues commands** — output is parsed with `aiResponseSchema`, and a validated service creates command rows.
- **English dictionary is the i18n type contract**; Arabic is `DeepPartial` with fallback.
- **Face state machine is a pure reducer** (`reduceFaceEvent`) — no side effects in state transitions.
- **Next 16 specifics:** native flat `eslint-config-next` (no `FlatCompat`), no `eslint` key in `next.config.ts`, React Hooks v6 compiler rules satisfied (async work deferred to microtasks; refs written in effects, not render).

## 7. Suggested next steps

1. Provision Neon + set the environment variables; run `db:migrate` and `db:seed` against it.
2. Connect an AI provider key and verify the assistant end-to-end.
3. Configure Cloudinary and test the media flow.
4. Pair a physical ESP32/NFC reader and run the `docs/HARDWARE.md` §6 bring-up checklist.
5. Swap `createRateLimiter` for a shared store before production traffic.
6. Replace the seeded development credentials and configure a real email transport.
7. Add 2FA for administrators if the console will be internet-facing.

## 8. Files to read first

| File | Why |
| --- | --- |
| `README.md` | Overview, quick start, scripts |
| `docs/SECURITY.md` | Threat model with pointers to the implementing code |
| `docs/HARDWARE.md` | The device protocol, signing scheme, safety rules |
| `src/server/services/commands.ts` | Where robot safety is actually enforced |
| `src/server/auth/device-auth.ts` | Device signing/verification and secret encryption |
| `src/lib/permissions.ts` | The permission catalogue and role baseline |
| `tests/helpers/db.ts` | How the isolated test databases work |
