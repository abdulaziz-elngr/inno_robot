import type { Dictionary } from "./en";
import type { DeepPartial } from "./shared";

/** Deep-merges a partial locale dictionary over the complete English one. */
export function deepMerge<T>(base: T, override: DeepPartial<T> | undefined): T {
  if (override === undefined || override === null) return base;
  if (Array.isArray(base)) return (override as T) ?? base;
  if (typeof base !== "object" || base === null) return (override as T) ?? base;
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (value === undefined) continue;
    const current = result[key];
    if (typeof value === "object" && value !== null && !Array.isArray(value) && typeof current === "object" && current !== null && !Array.isArray(current)) {
      result[key] = deepMerge(current, value as DeepPartial<typeof current>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

export type { Dictionary };
