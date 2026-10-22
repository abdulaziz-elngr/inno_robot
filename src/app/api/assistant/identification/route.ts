import { eq } from "drizzle-orm";
import { assertSameOrigin } from "@/server/auth/guard";
import { readStudentIdentification, setStudentIdentification } from "@/server/auth/identification";
import { db } from "@/server/db/client";
import { students } from "@/server/db/schema";
import { handle, json } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/assistant/identification — current terminal identification (from the signed
 * httpOnly cookie; a client cannot forge it). Used by the assistant UI to show who the
 * robot is greeting.
 */
export async function GET() {
  return handle(async () => {
    const studentId = await readStudentIdentification();
    if (!studentId) return json({ identified: false, student: null });
    const [student] = await db
      .select({
        id: students.id,
        firstNameEn: students.firstNameEn,
        firstNameAr: students.firstNameAr,
        status: students.status,
      })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    if (!student || student.status !== "ACTIVE") {
      await setStudentIdentification(null);
      return json({ identified: false, student: null });
    }
    return json({
      identified: true,
      student: { id: student.id, firstNameEn: student.firstNameEn, firstNameAr: student.firstNameAr },
    });
  });
}

/** DELETE /api/assistant/identification — "forget me" (clears the signed cookie). */
export async function DELETE(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    await setStudentIdentification(null);
    return json({ ok: true });
  });
}
