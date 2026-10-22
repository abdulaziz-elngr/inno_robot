import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const IDENTIFICATION_COOKIE = "inno_student";
const MAX_AGE_SECONDS = 12 * 60 * 60;

function key(): Buffer {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "inno-robot-identification-local-only").update("student-identification").digest();
}

function sign(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("base64url");
}

/**
 * Remembers (in an httpOnly, signed, expiring cookie) that a card identified a student at
 * this terminal. The chat endpoint verifies the signature, so a client cannot simply claim
 * to be another student to get a personalised answer.
 */
export async function setStudentIdentification(studentId: string | null): Promise<void> {
  const jar = await cookies();
  if (!studentId) {
    jar.delete(IDENTIFICATION_COOKIE);
    return;
  }
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = `${studentId}.${expires}`;
  jar.set(IDENTIFICATION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Returns the verified student id from the identification cookie, or null. */
export async function readStudentIdentification(): Promise<string | null> {
  const value = (await cookies()).get(IDENTIFICATION_COOKIE)?.value;
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [studentId, expiresRaw, signature] = parts as [string, string, string];
  const payload = `${studentId}.${expiresRaw}`;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(expiresRaw) * 1000 < Date.now()) return null;
  return studentId;
}
