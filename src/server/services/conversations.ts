import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { conversationMessages, conversations, students } from "@/server/db/schema";
import { paginationSchema } from "@/lib/validation/common";
import type { conversationQuerySchema } from "@/lib/validation/admin";
import type { z } from "zod";

export async function getOrCreateConversation(input: {
  conversationId?: string;
  guestId?: string;
  studentId?: string;
  language: "ar" | "en";
}): Promise<string> {
  if (input.conversationId) {
    const [existing] = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.id, input.conversationId)).limit(1);
    if (existing) {
      if (input.studentId) {
        await db.update(conversations).set({ studentId: input.studentId, updatedAt: new Date() }).where(eq(conversations.id, existing.id));
      }
      return existing.id;
    }
  }
  const id = crypto.randomUUID();
  await db.insert(conversations).values({
    id,
    guestId: input.guestId ?? null,
    studentId: input.studentId ?? null,
    language: input.language,
  });
  return id;
}

export type StoredMessage = { role: "USER" | "ASSISTANT" | "SYSTEM"; content: string; origin?: string | null };

export async function appendMessage(
  conversationId: string,
  message: StoredMessage,
  intent?: string | null,
): Promise<void> {
  await db.insert(conversationMessages).values({
    id: crypto.randomUUID(),
    conversationId,
    role: message.role,
    content: message.content,
    origin: message.origin ?? null,
    intent: intent ?? null,
  });
  await db
    .update(conversations)
    .set({ messageCount: sql`${conversations.messageCount} + 1`, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

/** Recent turns used as model context (oldest first). */
export async function getRecentMessages(conversationId: string, limit: number): Promise<StoredMessage[]> {
  const rows = await db
    .select({ role: conversationMessages.role, content: conversationMessages.content, origin: conversationMessages.origin })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(desc(conversationMessages.createdAt))
    .limit(limit);
  return rows.reverse().map((r) => ({ role: r.role, content: r.content, origin: r.origin }));
}

export async function clearConversation(conversationId: string): Promise<void> {
  await db.delete(conversationMessages).where(eq(conversationMessages.conversationId, conversationId));
  await db.update(conversations).set({ messageCount: 0, updatedAt: new Date() }).where(eq(conversations.id, conversationId));
}

/** Admin listing: metadata only — message bodies stay out of list views. */
export async function listConversations(query: z.infer<typeof conversationQuerySchema>) {
  const { page, pageSize, q, language, days } = query;
  const since = new Date(Date.now() - days * 86_400_000);
  const filters = [gte(conversations.updatedAt, since)];
  if (language) filters.push(eq(conversations.language, language));
  if (q) filters.push(sql`${conversations.id}::text like ${`%${q}%`}`);
  const where = and(...filters);

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: conversations.id,
        language: conversations.language,
        messageCount: conversations.messageCount,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        studentFirstNameEn: students.firstNameEn,
        studentFirstNameAr: students.firstNameAr,
        isGuest: sql<boolean>`(${conversations.studentId} is null)`,
      })
      .from(conversations)
      .leftJoin(students, eq(conversations.studentId, students.id))
      .where(where)
      .orderBy(desc(conversations.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(conversations).where(where),
  ]);
  return { rows, total: totalRow[0]?.count ?? 0, page, pageSize };
}

export async function getConversationDetail(id: string) {
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  if (!conversation) return null;
  const messages = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, id))
    .orderBy(conversationMessages.createdAt)
    .limit(500);
  return { conversation, messages };
}

/** Count of conversations updated within the window (real metric for the dashboard). */
export async function countConversations(days = 30): Promise<number> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db.select({ count: sql<number>`count(*)::int` }).from(conversations).where(gte(conversations.updatedAt, since));
  return rows[0]?.count ?? 0;
}

/** Message volume per day for analytics (counts only — no content). */
export async function messageSeries(days = 14): Promise<Array<{ day: string; user: number; assistant: number }>> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${conversationMessages.createdAt}), 'YYYY-MM-DD')`,
      role: conversationMessages.role,
      count: sql<number>`count(*)::int`,
    })
    .from(conversationMessages)
    .where(gte(conversationMessages.createdAt, since))
    .groupBy(sql`date_trunc('day', ${conversationMessages.createdAt})`, conversationMessages.role)
    .orderBy(sql`1`);

  const byDay = new Map<string, { user: number; assistant: number }>();
  for (const row of rows) {
    const entry = byDay.get(row.day) ?? { user: 0, assistant: 0 };
    if (row.role === "USER") entry.user += row.count;
    else if (row.role === "ASSISTANT") entry.assistant += row.count;
    byDay.set(row.day, entry);
  }
  return [...byDay.entries()].map(([day, v]) => ({ day, ...v }));
}

/** Intent distribution (privacy-preserving: counts only). */
export async function intentCounts(days = 30): Promise<Array<{ intent: string; count: number }>> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db
    .select({ intent: conversationMessages.intent, count: sql<number>`count(*)::int` })
    .from(conversationMessages)
    .where(and(gte(conversationMessages.createdAt, since), inArray(conversationMessages.intent, [
      "GENERAL_QUESTION",
      "LOCATION_LOOKUP",
      "NAVIGATION_REQUEST",
      "UNIVERSITY_INFORMATION",
      "STUDENT_INFORMATION",
      "HUMAN_ASSISTANCE_REQUEST",
    ])))
    .groupBy(conversationMessages.intent)
    .orderBy(desc(sql`count(*)`));
  return rows
    .filter((row): row is { intent: string; count: number } => row.intent !== null)
    .map((row) => ({ intent: row.intent, count: row.count }));
}

/** Removes conversations older than the configured retention window. */
export async function pruneConversations(retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const old = await db.select({ id: conversations.id }).from(conversations).where(sql`${conversations.createdAt} < ${cutoff}`).limit(500);
  if (!old.length) return 0;
  await db.delete(conversations).where(inArray(conversations.id, old.map((r) => r.id)));
  return old.length;
}

export const conversationPagination = paginationSchema;
