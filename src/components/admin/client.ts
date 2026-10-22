"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Uniform JSON API call for admin client components. Throws with the server's message. */
export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { "content-type": "application/json" }, ...init });
  const body = (await res.json().catch(() => null)) as (T & { error?: string; code?: string }) | null;
  if (!res.ok) {
    const message = body && typeof body === "object" && "error" in body && body.error ? body.error : `Request failed (${res.status})`;
    throw new AdminApiError(message, body && typeof body === "object" && "code" in body ? (body.code as string) : undefined, res.status);
  }
  return body as T;
}

export class AdminApiError extends Error {
  constructor(message: string, public readonly code?: string, public readonly status?: number) {
    super(message);
    this.name = "AdminApiError";
  }
}

/** Simple loading/error/list state for admin pages that fetch client-side. */
export function useAsyncData<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumped by `reload` and whenever the caller's `deps` change; drives the fetch effect.
  const [version, setVersion] = useState(0);

  // Callers pass a fresh inline closure every render, so the loader lives in a ref and
  // the effect keys off `deps` (serialized) + `version` instead of function identity.
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });
  const depsKey = JSON.stringify(deps);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    // Kick off in a microtask so the effect body itself never sets state synchronously
    // (react-hooks/set-state-in-effect) while still re-fetching on deps/reload changes.
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      loaderRef
        .current()
        .then((value) => {
          if (cancelled) return;
          setData(value);
          setError(null);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [depsKey, version]);

  return { data, error, loading, reload };
}
