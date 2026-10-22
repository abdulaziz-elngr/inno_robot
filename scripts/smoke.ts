import { loadEnv } from "./lib/env";

loadEnv();

/**
 * End-to-end smoke verification against a RUNNING server.
 *
 *   npm run dev            # or `npm run build && npm start`
 *   npm run verify         # in another terminal
 *   npm run verify -- --base http://localhost:3000
 *
 * It checks only what can be checked honestly from the outside:
 *   1. /api/health reports a reachable database,
 *   2. the AI provider state is reported accurately (configured OR explicit fallback),
 *   3. public pages render,
 *   4. an unauthenticated admin call is refused (401),
 *   5. dev credentials can sign in and the session resolves,
 *   6. the signed-in administrator can list robots.
 *
 * It never fabricates hardware or AI traffic, and exits non-zero on any failure.
 */

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

const BASE = (flag("base") ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const EMAIL = flag("email") ?? "admin@inno-robot.test";
const PASSWORD = flag("password") ?? "InnoRobot#2026";

type Check = { name: string; ok: boolean; detail: string };
const results: Check[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function get(path: string, init?: RequestInit): Promise<{ status: number; body: unknown; headers: Headers }> {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual", ...init });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text.slice(0, 200);
  }
  return { status: res.status, body, headers: res.headers };
}

function cookieOf(headers: Headers): string | null {
  const raw = headers.getSetCookie?.() ?? [];
  const session = raw.find((c) => c.startsWith("inno_session="));
  if (!session) return null;
  return `inno_session=${session.split(";")[0]!.split("=")[1]!}`;
}

async function main() {
  console.log(`\n[smoke] verifying ${BASE}\n`);

  // 1. Health -----------------------------------------------------------------
  try {
    const { status, body } = await get("/api/health");
    const b = body as { database?: { ok?: boolean; error?: string }; simulationAllowed?: boolean } | null;
    const dbOk = status === 200 && b?.database?.ok === true;
    record("GET /api/health", dbOk, dbOk ? "database reachable" : (b?.database?.error ?? `status ${status}`));
    if (dbOk) console.log(`        simulation allowed: ${String(b?.simulationAllowed)}`);
  } catch (error) {
    record("GET /api/health", false, `server not reachable — is it running? (${(error as Error).message})`);
    return finish();
  }

  // 2. Assistant status -------------------------------------------------------
  try {
    const { status, body } = await get("/api/assistant/status");
    const b = body as { configured?: boolean; fallbackMode?: boolean; knowledgeArticles?: number } | null;
    const ok = status === 200 && typeof b?.configured === "boolean";
    record(
      "GET /api/assistant/status",
      ok,
      ok
        ? b?.configured
          ? `AI configured (fallbackMode=${String(b?.fallbackMode)})`
          : "AI not configured — explicit fallback mode (expected without a provider key)"
        : `status ${status}`,
    );
  } catch (error) {
    record("GET /api/assistant/status", false, (error as Error).message);
  }

  // 3. Public pages -----------------------------------------------------------
  for (const page of ["/", "/assistant", "/campus", "/login"]) {
    try {
      const { status } = await get(page);
      record(`GET ${page}`, status === 200, `status ${status}`);
    } catch (error) {
      record(`GET ${page}`, false, (error as Error).message);
    }
  }

  // 4. Admin API refuses anonymous callers ------------------------------------
  try {
    const { status, body } = await get("/api/admin/robots");
    const b = body as { code?: string } | null;
    record("anonymous admin call refused", status === 401 && b?.code === "UNAUTHENTICATED", `status ${status}, code=${b?.code}`);
  } catch (error) {
    record("anonymous admin call refused", false, (error as Error).message);
  }

  // 5. Dev login --------------------------------------------------------------
  let cookie: string | null = null;
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    cookie = res.ok ? cookieOf(res.headers) : null;
    record(
      "POST /api/auth/login",
      res.ok && cookie !== null,
      res.ok ? `signed in as ${EMAIL}` : (body?.error ?? `status ${res.status} — run \`npm run db:seed\` for dev credentials`),
    );
  } catch (error) {
    record("POST /api/auth/login", false, (error as Error).message);
  }

  // 6. Authenticated admin call -----------------------------------------------
  if (cookie) {
    try {
      const { status, body } = await get("/api/admin/robots", { headers: { cookie } });
      const b = body as { rows?: unknown[] } | null;
      const ok = status === 200 && Array.isArray(b?.rows);
      record(
        "authenticated admin call",
        ok,
        ok ? `${b!.rows!.length} robot(s) visible` : `status ${status}`,
      );
      if (ok && b!.rows!.length === 0) console.log("        tip: run `npm run db:seed` to create the simulated robots");
    } catch (error) {
      record("authenticated admin call", false, (error as Error).message);
    }
  } else {
    record("authenticated admin call", false, "skipped — no session cookie");
  }

  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n[smoke] ${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("[smoke] FAILED:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    console.log("");
    process.exit(1);
  }
  console.log("[smoke] OK\n");
}

main().catch((error: unknown) => {
  console.error("[smoke] unexpected error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
