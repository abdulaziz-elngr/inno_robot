# Inno Robot

AI-powered university assistant platform: a bilingual (Arabic/English) web experience, an animated SVG robot face, NFC student identification, a campus directory, a knowledge base, and authenticated IoT control of a campus robot — with a full admin console.

> **Honesty note.** Everything in this repository is real code that runs. Where hardware or third-party services are unavailable, the platform says so explicitly:
> - Robot traffic produced by the built-in simulator is labelled `SIMULATED` everywhere it appears (database column, API payloads, UI badges). It is never presented as real telemetry.
> - When no AI provider key is configured, the assistant reports "AI not configured" and answers from the published knowledge base only. It never fakes model output.
> - When Cloudinary is not configured, uploads are refused with a clear message instead of silently failing.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) · React 19 · TypeScript strict |
| Styling | Tailwind 4 · shadcn-style components · Lucide · Framer Motion |
| Database | PostgreSQL (Neon) via Drizzle ORM · embedded **PGlite** fallback for local dev — **no SQLite anywhere** |
| Validation | Zod |
| Passwords | Argon2id (`@node-rs/argon2`) |
| Device auth | HMAC-SHA256 request signing · AES-256-GCM secret storage |
| AI | Any OpenAI-compatible endpoint, server-side keys only |
| Tests | Vitest (7 suites, 79 tests) against an isolated embedded PGlite database |

## Quick start

```bash
npm install
cp .env.example .env        # then fill in values (see below)
npm run db:migrate          # apply SQL migrations
npm run db:seed             # create dev administrators, sample content, simulated robots
npm run dev                 # http://localhost:3000
```

With no `DATABASE_URL` set, the app automatically uses an embedded PGlite database under `.data/` — zero external services needed to develop.

**Development sign-in** (created by the seed script):

```
email:    admin@inno-robot.test
password: InnoRobot#2026
```

### Try the robot without hardware

```bash
npm run dev          # in one terminal
npm run sim:robot    # in another — starts the clearly-labelled simulator
```

The simulator signs its requests with the same HMAC scheme the ESP32 firmware uses (credentials are written to `.data/sim-device.json` by the seed script), posts telemetry, polls for commands, and acknowledges them. Everything it produces is stored with `simulated = true`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint (flat config, Next 16 rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` / `npm run test:watch` | Vitest |
| `npm run db:generate` | Generate migrations from schema changes |
| `npm run db:migrate` | Apply migrations (`DIRECT_URL`) |
| `npm run db:seed` | Seed dev data (idempotent) |
| `npm run sim:robot` | Run the device simulator |
| `npm run verify` | End-to-end smoke script |

## Environment variables

Copy `.env.example` to `.env`. The variables that matter:

| Variable | Required | Notes |
| --- | --- | --- |
| `APP_BASE_URL` | prod | Canonical URL; also used for CSRF origin checks |
| `DATABASE_URL` | prod | Neon **pooled** endpoint |
| `DIRECT_URL` | prod | Neon **direct** endpoint — migrations only |
| `AUTH_SECRET` | prod | `openssl rand -base64 48` |
| `DEVICE_AUTH_SECRET` | prod | `openssl rand -hex 32` — keys device secret encryption |
| `AI_API_KEY` | optional | Empty ⇒ assistant falls back to knowledge base |
| `AI_BASE_URL` / `AI_MODEL` | optional | Any OpenAI-compatible endpoint |
| `CLOUDINARY_*` | optional | Empty ⇒ uploads refused with a clear state |
| `ENABLE_SIMULATION` | dev | Simulation stays off in production unless explicitly `"true"` |
| `ALLOW_EMBEDDED_DB` | local prod builds | Set `1` only to run a production build without Neon |

## Documentation

| Document | Contents |
| --- | --- |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel + Neon + Cloudinary deployment, environment, migrations |
| [docs/HARDWARE.md](docs/HARDWARE.md) | ESP32 integration, NFC reader, the signing scheme, MQTT option |
| [docs/API.md](docs/API.md) | Every route, its permission, and its payload |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model, auth, device credentials, privacy posture |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common failures and their fixes |

## Project layout

```
src/
  app/                 Routes — (site) public pages, (auth) auth pages, admin/, api/
  components/          UI kit (ui/), admin console, assistant, robot face, control panel
  lib/                 i18n dictionaries (en/ar), validation schemas, permissions
  server/
    auth/              Sessions, RBAC, rate limiting, device HMAC verification
    db/                Drizzle client (Neon | PGlite), schema, migrations runner
    services/          Domain logic (students, cards, nfc, commands, devices, ai, ...)
scripts/               seed, migrate, device simulator, smoke test
tests/                 Vitest suites (isolated embedded PGlite per file)
drizzle/               Generated SQL migrations
```

## Testing

Every test file boots its **own** embedded PGlite database in a temp directory (`tests/helpers/db.ts` sets `EMBEDDED_DB_DIR`), applies the real migrations, and deletes it afterwards. Tests never touch your development database, and `DATABASE_URL` is forcibly removed so a test run can never hit Neon.

```bash
npm test                        # all suites
npm test -- tests/commands.test.ts   # one suite
```

Covered guarantees include: password policy and argon2id hashing, card association/revocation, NFC deduplication, device HMAC authentication (including replay-window and revocation), AI response schema enforcement, navigation destination resolution, command gating (manual-mode, offline, confirmation, speed limits), command expiry, and emergency-stop priority.

## License

Private project — all rights reserved.
