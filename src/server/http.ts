import { ApiError } from "@/server/auth/guard";
import { ZodError, type ZodType } from "zod";

/** JSON response helper. */
export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

/** Wraps a route handler with uniform error handling (never leaks internals). */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) {
      return json({ error: error.message, code: error.code ?? null }, { status: error.status });
    }
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
      return json({ error: "Validation failed.", code: "VALIDATION_FAILED", issues }, { status: 400 });
    }
    console.error("[api] unhandled error:", error instanceof Error ? error.stack ?? error.message : error);
    return json({ error: "Internal server error.", code: "INTERNAL" }, { status: 500 });
  }
}

/** Reads and parses a JSON body with a size guard. */
export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError(415, "Expected application/json.", "UNSUPPORTED_MEDIA_TYPE");
  }
  const raw = await req.text();
  if (raw.length > 128 * 1024) throw new ApiError(413, "Request body too large.", "PAYLOAD_TOO_LARGE");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "Malformed JSON body.", "INVALID_JSON");
  }
  return schema.parse(parsed);
}

/** Raw body text (needed for device signature verification). */
export async function readRawBody(req: Request): Promise<string> {
  const raw = await req.text();
  if (raw.length > 128 * 1024) throw new ApiError(413, "Request body too large.", "PAYLOAD_TOO_LARGE");
  return raw;
}

/**
 * Simulation endpoints (in-browser demo NFC identification) are development-only by
 * default. Production deployments must opt in explicitly with ENABLE_SIMULATION=true —
 * simulated events are always flagged and never impersonate a real hardware event.
 */
export function assertSimulationAllowed(): void {
  const flag = process.env.ENABLE_SIMULATION;
  if (flag === "true") return;
  if (flag === "false") throw new ApiError(403, "Simulation endpoints are disabled on this deployment.", "SIMULATION_DISABLED");
  if (process.env.NODE_ENV === "production") {
    throw new ApiError(403, "Simulation endpoints are disabled in production. Set ENABLE_SIMULATION=true to enable them deliberately.", "SIMULATION_DISABLED");
  }
}

export function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;
}
