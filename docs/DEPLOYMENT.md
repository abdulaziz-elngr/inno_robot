# Deployment

Target stack: **Vercel** (Next.js) + **Neon** (PostgreSQL) + **Cloudinary** (media) + an optional OpenAI-compatible AI provider.

---

## 1. Database (Neon)

1. Create a project at [neon.tech](https://neon.tech) and note **two** connection strings:
   - **Pooled** endpoint (pgbouncer) → `DATABASE_URL` — used at runtime.
   - **Direct** endpoint → `DIRECT_URL` — used only by migrations (`npm run db:migrate`), because DDL cannot run through the pooler.
2. Neon databases are TLS-only. The Drizzle client reads `DATABASE_SSL`; leave it unset for Neon (TLS on by default) and set it to `disable` only for a local Postgres without TLS.
3. Application IDs are generated in the application (`text` UUID primary keys, no database default), so the same migrations work on Neon and on the embedded PGlite database — no sequence/serial portability traps.

## 2. Application (Vercel)

1. Import the repository in Vercel. Framework preset: **Next.js**. No custom build command needed.
2. Set every variable from `.env.example` in **Project → Settings → Environment Variables** (Production *and* Preview):

   | Variable | Value |
   | --- | --- |
   | `APP_BASE_URL` | `https://your-domain.example` (no trailing slash) |
   | `NEXT_PUBLIC_APP_BASE_URL` | same value |
   | `DATABASE_URL` | Neon pooled endpoint |
   | `DIRECT_URL` | Neon direct endpoint |
   | `AUTH_SECRET` | `openssl rand -base64 48` |
   | `DEVICE_AUTH_SECRET` | `openssl rand -hex 32` |
   | `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | optional |
   | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | optional |

3. **Do not set `ENABLE_SIMULATION` in production.** Simulation endpoints return `403 SIMULATION_DISABLED` unless you deliberately opt in with `ENABLE_SIMULATION=true`. The simulator-produced robot rows keep `simulated = true` in the database regardless.
4. Deploy. Migrations are **not** run automatically — see the next step.

## 3. Migrations

Run migrations from your machine (or a CI job) against the **direct** endpoint:

```bash
DIRECT_URL=<direct-endpoint> npm run db:migrate
```

Migrations live in `drizzle/` as plain SQL (`0000_init.sql`) and are applied by `scripts/migrate.ts`. This is deliberately separate from `next build` so a schema change can never race a deployment.

> `npm run dev` with no `DATABASE_URL` uses an embedded PGlite database under `.data/`. That path never touches Neon.

## 4. Seed

```bash
DATABASE_URL=<pooled-endpoint> npm run db:seed
```

The seed script is **idempotent** — re-running it updates rather than duplicates. It creates:

- the development administrators (`admin@inno-robot.test`, `operator@…`, `content@…`) — *change these passwords immediately on any shared environment*,
- the six roles and the permission catalogue,
- sample faculties/departments, campus locations, knowledge articles, navigation destinations,
- two **simulated** robots (`INNO-01`, `INNO-02`) whose device secrets are written to `.data/sim-device.json` (git-ignored).

For a real robot, register it from **Admin → Robots → Register** — the plaintext secret is shown exactly once.

## 5. Cloudinary (optional)

Unsigned client uploads are never used. The flow is two-step and server-signed:

1. `POST /api/admin/media` with `action: "sign"` → the server returns a Cloudinary signature (permission `media.manage`).
2. The browser uploads directly to Cloudinary with that signature.
3. `POST /api/admin/media` with `action: "record"` stores the asset metadata.

If the `CLOUDINARY_*` variables are empty, step 1 refuses with a clear "Cloudinary not configured" state instead of failing silently.

## 6. AI provider (optional)

Any OpenAI-compatible endpoint works (`AI_BASE_URL` + `AI_MODEL` + `AI_API_KEY`). The key is **server-side only** and is never exposed through `NEXT_PUBLIC_*`.

When no key is configured:

- `GET /api/assistant/status` reports `configured: false, fallbackMode: true`,
- the assistant answers **only** from published knowledge-base articles and marks answers it could not verify with `unverified: true`,
- the UI displays an explicit "AI not configured" banner.

## 7. Custom domain + HTTPS

Attach the domain in Vercel, then set `APP_BASE_URL` to the final HTTPS origin. This value is used for CSRF origin checks (`assertSameOrigin`) and password-reset links — a mismatch between the deployed origin and `APP_BASE_URL` will cause `403 BAD_ORIGIN` on every admin mutation.

## 8. Health check

`GET /api/health` returns database reachability, migration state, and whether simulation is allowed. Point your uptime monitor at it.

## 9. Serverless caveats

- **Rate limiters are in-memory** (`src/server/auth/rate-limit.ts`). On serverless, instances do not share state, so limits are per-instance. `createRateLimiter` is the single integration point for swapping in a shared store (Redis/Upstash) — see `docs/SECURITY.md`.
- **No background timers.** Simulated command completion and stale-command expiry run opportunistically when the queue is read or written, which works on serverless. Do not add `setInterval`-based server logic.
- Polling (not WebSockets) is used for device/robot state, which is serverless-friendly by design.
