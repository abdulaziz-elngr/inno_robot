import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id (OWASP-recommended parameters), memory-hard and native-accelerated.
 * Stored format: the standard PHC string produced by @node-rs/argon2 (`$argon2id$...`).
 *
 * `Algorithm` is an ambient const enum in the package typings, which cannot be
 * referenced under `isolatedModules`; Argon2id === 2 per the PHC spec.
 */
const ARGON2ID = 2;

const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

/** Constant-time verification. Returns false for malformed or unknown hashes. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored || !stored.startsWith("$argon2")) return false;
  try {
    return await verify(stored, password, OPTIONS);
  } catch {
    return false;
  }
}

/** Minimum policy for administrative passwords. */
export function assertPasswordStrength(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters long.";
  if (!/[a-z]/i.test(password)) return "Password must contain a letter.";
  if (!/[0-9]/.test(password)) return "Password must contain a number.";
  return null;
}
