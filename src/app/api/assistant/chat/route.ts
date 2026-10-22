import { eq } from "drizzle-orm";
import { assertSameOrigin } from "@/server/auth/guard";
import { chatLimiter } from "@/server/auth/rate-limit";
import { readStudentIdentification, setStudentIdentification } from "@/server/auth/identification";
import { db } from "@/server/db/client";
import { students } from "@/server/db/schema";
import { chatRequestSchema } from "@/lib/validation/assistant";
import { assertAssistantQuota, runAssistant } from "@/server/services/ai";
import { clientIp, handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/assistant/chat — validated conversation endpoint.
 * The AI provider key never leaves the server; only the first name needed for a greeting
 * is ever forwarded to the model.
 */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const ip = clientIp(req);
    const limit = chatLimiter.check(ip ?? "unknown");
    if (!limit.ok) {
      return json({ error: "Too many messages. Please slow down.", code: "CHAT_RATE_LIMITED" }, { status: 429 });
    }
    assertAssistantQuota(ip);

    const input = await readJson(req, chatRequestSchema);

    // The signed identification cookie wins over a client-supplied id (anti-impersonation).
    const identified = await readStudentIdentification();
    const studentId = identified ?? undefined;
    if (identified) await setStudentIdentification(identified);

    let studentFirstName: string | null = null;
    if (studentId) {
      const [student] = await db
        .select({ firstNameEn: students.firstNameEn, firstNameAr: students.firstNameAr, status: students.status })
        .from(students)
        .where(eq(students.id, studentId))
        .limit(1);
      if (student && student.status === "ACTIVE") {
        studentFirstName = input.language === "ar" ? student.firstNameAr : student.firstNameEn;
      }
    }

    const result = await runAssistant(
      { ...input, studentId },
      { ip, studentFirstName },
    );

    return json({
      conversationId: result.conversationId,
      response: result.response,
      origin: result.origin,
      contextItems: result.contextItems,
      studentGreeting: studentFirstName,
    });
  });
}
