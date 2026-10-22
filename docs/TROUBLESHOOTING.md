# Troubleshooting

Symptom → cause → fix. Each item maps to a real code path.

---

## Install & build

**`npm run lint` crashes with `Converting circular structure to JSON`**
The ESLint config was using the legacy `FlatCompat` bridge. Next 16 ships `eslint-config-next` as native flat config — `eslint.config.mjs` must import `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` directly (this is already the case in this repo).

**`tsc` reports `Type 'null' is not assignable to type 'string'` on a location input**
`room`, `imageUrl` and the description fields are `optionalText(...)` — they default to `""` and do **not** accept `null`. Pass `""` for "no value"; only `buildingId`/`floorId`/`latitude`/`longitude` accept `null`.

**`Algorithm` cannot be used as a value under `isolatedModules`**
`@node-rs/argon2`'s `Algorithm` is a const enum, which is unusable under `isolatedModules`. The code uses the literal `ARGON2ID = 2` instead — do not reintroduce the import.

**Build fails with a Next config warning about `eslint`**
Next 16 removed the `eslint` key from `next.config.ts`. Lint is run explicitly via `npm run lint`.

## Database

**`npm run db:migrate` fails against Neon with a pooler error**
Migrations must run against the **direct** endpoint (`DIRECT_URL`), not the pooled one (`DATABASE_URL`). DDL cannot go through pgbouncer.

**Tests fail with `could not open file "base/5/…"` or missing-table errors**
The embedded PGlite directory was deleted while a suite was still using it. Every `describe` in one test file shares **one** database (the helper memoizes it), so `afterAll(cleanupTestDb)` must appear **once per file**, at the top level — not inside each `describe`.

**An insert fails with "null value in column id"**
`idCol()` is `text("id").primaryKey()` with **no database default**. Every insert must supply an explicit `id` (services already do this; hand-written test inserts often forget it).

**A test accidentally hit my real database**
It cannot: `tests/helpers/db.ts` deletes `process.env.DATABASE_URL` and points `EMBEDDED_DB_DIR` at a fresh temp directory before anything imports the DB client. If you see a real DB being touched, the import order was changed — `initTestDb()` must be awaited before any service import.

## Devices & NFC

**Robot shows `OFFLINE` although the firmware is running**
The device is considered online only if it posted telemetry/heartbeat within **45 s** (`ONLINE_THRESHOLD_SECONDS`). Check the firmware clock (NTP) — a timestamp outside **±300 s** is rejected with `401 DEVICE_TIMESTAMP_INVALID`.

**`401 DEVICE_SIGNATURE_INVALID` with a correct-looking signature**
The signature covers the **raw body bytes**. If the firmware signs a re-serialized JSON string and then sends different bytes (key order, whitespace, Unicode escaping), verification fails. Sign exactly the string you transmit — see `scripts/device-simulator.ts` for a working reference.

**`403 DEVICE_REVOKED` after a rotation**
Rotation replaces the secret immediately. Update the firmware with the **new** secret from the rotation response (it is shown once).

**A second greeting for the same card scan**
Deduplication is per device, per card, within a **30 s window**. If the robot genuinely re-reads after the window, a second greeting is correct. To suppress it across retries, send a stable client `eventId` with the event.

**Movement command returns `428 MANUAL_MODE_REQUIRED`**
Working as designed: movement requires an explicit manual-mode acknowledgement in the control UI. `STOP` does not.

**Movement returns `409 DEVICE_OFFLINE` but the robot looks fine**
The stored status is `OFFLINE`. Telemetry with `"status": "IDLE"`/`"ONLINE"` refreshes it; otherwise the robot idles out after the 45 s threshold.

**`409 NAVIGATION_UNAVAILABLE`**
The destination's location exists but is not both `published` and `navigable`. Fix it in **Admin → Locations**.

**A queued command shows `CANCELLED (Superseded by emergency stop`)**
By design: emergency STOP cancels all queued movement in the same transaction.

## Assistant & AI

**Assistant says "AI not configured"**
`AI_API_KEY` is empty. That is an explicit, honest state — the assistant then answers only from published knowledge articles. Set `AI_BASE_URL`/`AI_MODEL`/`AI_API_KEY` to enable a provider.

**Assistant answers are marked `unverified`**
The model could not confirm the answer from the knowledge base; the flag exists so unverified text is never presented as fact. Publish the relevant article and ask again.

**Answers arrive in the wrong language**
The request carries `language` (`ar`/`en`); the client sends the active locale. Check the payload rather than the model.

## Media

**Uploads fail with "Cloudinary not configured"**
`CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` are empty. The platform refuses rather than failing silently.

**`403 BAD_ORIGIN` on any admin save**
`APP_BASE_URL` does not match the origin the browser is sending. Set it to the exact canonical origin (no trailing slash) — it is used by `assertSameOrigin`.

## Simulation

**`/api/assistant/demo/*` returns `403 SIMULATION_DISABLED`**
Simulation is off in production unless you deliberately set `ENABLE_SIMULATION=true`. In development it is on by default.

**The simulator exits with "`.data/sim-device.json` not found"**
Run `npm run db:seed` first — it writes the simulated device secrets there (git-ignored).

**Simulated robot data looks real**
It never is: simulated rows carry `simulated = true` end-to-end and are labelled `SIMULATED` in the UI.

## Rate limiting

**Legitimate users hit `429` on a shared NAT**
The limiters are in-memory and keyed per IP. Behind a proxy, ensure `x-forwarded-for` is set correctly (`clientIp()` reads it first).

**Limits seem not to apply in production**
On serverless, instances do not share limiter state, so limits are per-instance. Swap `createRateLimiter` for a shared store (Redis/Upstash) before relying on them cluster-wide — see `docs/SECURITY.md` §12.

## Verifying a change

```bash
npm run lint        # must be clean (0 errors, 0 warnings)
npm run typecheck   # tsc --noEmit
npm test            # 7 suites, 79 tests, isolated embedded PGlite per file
npm run build       # production build
npm run verify      # end-to-end smoke script
```
