import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { ApiError } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { knowledgeArticles, knowledgeCategories } from "@/server/db/schema";
import type { KnowledgeArticleInput, knowledgeQuerySchema } from "@/lib/validation/admin";
import type { z } from "zod";
import { audit } from "./audit";

type KnowledgeQuery = z.infer<typeof knowledgeQuerySchema>;

/** Lists articles for the admin (all statuses). */
export async function listKnowledge(query: KnowledgeQuery) {
  const { page, pageSize, q, status, categoryId, language } = query;
  const filters = [];
  if (q) {
    const like = `%${q}%`;
    filters.push(or(ilike(knowledgeArticles.title, like), ilike(knowledgeArticles.content, like)));
  }
  if (status) filters.push(eq(knowledgeArticles.status, status));
  if (categoryId) filters.push(eq(knowledgeArticles.categoryId, categoryId));
  if (language) filters.push(eq(knowledgeArticles.language, language));
  const where = filters.length ? and(...filters) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: knowledgeArticles.id,
        title: knowledgeArticles.title,
        language: knowledgeArticles.language,
        status: knowledgeArticles.status,
        updatedAt: knowledgeArticles.updatedAt,
        publishedAt: knowledgeArticles.publishedAt,
        reviewAt: knowledgeArticles.reviewAt,
        sourceDocument: knowledgeArticles.sourceDocument,
        categoryId: knowledgeArticles.categoryId,
        categoryNameEn: knowledgeCategories.nameEn,
        excerpt: sql<string>`left(${knowledgeArticles.content}, 140)`,
      })
      .from(knowledgeArticles)
      .leftJoin(knowledgeCategories, eq(knowledgeArticles.categoryId, knowledgeCategories.id))
      .where(where)
      .orderBy(desc(knowledgeArticles.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(knowledgeArticles).where(where),
  ]);
  return { rows, total: totalRow[0]?.count ?? 0, page, pageSize };
}

export async function getKnowledgeArticle(id: string) {
  const [row] = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.id, id)).limit(1);
  if (!row) throw new ApiError(404, "Article not found.", "ARTICLE_NOT_FOUND");
  return row;
}

export async function createKnowledgeArticle(input: KnowledgeArticleInput, authorId: string) {
  const id = crypto.randomUUID();
  await db.insert(knowledgeArticles).values({
    id,
    categoryId: input.categoryId || null,
    title: input.title,
    content: input.content,
    language: input.language,
    tags: input.tags,
    status: input.status,
    sourceDocument: input.sourceDocument || null,
    reviewAt: input.reviewAt ? new Date(input.reviewAt) : null,
    publishedAt: input.status === "PUBLISHED" ? new Date() : null,
    authorId,
  });
  await audit({ actorUserId: authorId, actorLabel: "admin", action: "knowledge.created", targetType: "article", targetId: id });
  return id;
}

export async function updateKnowledgeArticle(id: string, input: KnowledgeArticleInput, actorId: string) {
  await getKnowledgeArticle(id);
  await db
    .update(knowledgeArticles)
    .set({
      categoryId: input.categoryId || null,
      title: input.title,
      content: input.content,
      language: input.language,
      tags: input.tags,
      status: input.status,
      sourceDocument: input.sourceDocument || null,
      reviewAt: input.reviewAt ? new Date(input.reviewAt) : null,
      publishedAt: input.status === "PUBLISHED" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(knowledgeArticles.id, id));
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "knowledge.updated", targetType: "article", targetId: id, metadata: { status: input.status } });
}

export async function setKnowledgeStatus(id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED", actorId: string) {
  await db
    .update(knowledgeArticles)
    .set({ status, publishedAt: status === "PUBLISHED" ? new Date() : null, updatedAt: new Date() })
    .where(eq(knowledgeArticles.id, id));
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "knowledge.status_changed", targetType: "article", targetId: id, metadata: { status } });
}

export async function deleteKnowledgeArticle(id: string, actorId: string) {
  await db.delete(knowledgeArticles).where(eq(knowledgeArticles.id, id));
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "knowledge.deleted", targetType: "article", targetId: id });
}

export type KnowledgeHit = {
  id: string;
  title: string;
  content: string;
  language: string;
  categoryName: string | null;
  score: number;
};

/**
 * Retrieval over PUBLISHED content only — draft/archived material can never reach a student.
 * Deterministic keyword scoring keeps this dependency-free; swap for pgvector/embeddings later.
 */
export async function searchPublishedKnowledge(opts: {
  query: string;
  language?: "ar" | "en" | "both";
  limit?: number;
}): Promise<KnowledgeHit[]> {
  const terms = opts.query
    .split(/[\s،,.؟?؟!]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 8);
  if (!terms.length) return [];

  const likeTerms = terms.map((t) => `%${t}%`);
  const conditions = likeTerms.map((t) => or(ilike(knowledgeArticles.title, t), ilike(knowledgeArticles.content, t)));

  const rows = await db
    .select({
      id: knowledgeArticles.id,
      title: knowledgeArticles.title,
      content: knowledgeArticles.content,
      language: knowledgeArticles.language,
      categoryNameEn: knowledgeCategories.nameEn,
      categoryNameAr: knowledgeCategories.nameAr,
    })
    .from(knowledgeArticles)
    .leftJoin(knowledgeCategories, eq(knowledgeArticles.categoryId, knowledgeCategories.id))
    .where(and(eq(knowledgeArticles.status, "PUBLISHED"), or(...conditions)))
    .limit(40);

  const language = opts.language ?? "en";
  const scored = rows.map((row) => {
    const haystack = `${row.title}\n${row.content}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      const t = term.toLowerCase();
      if (row.title.toLowerCase().includes(t)) score += 3;
      const matches = haystack.split(t).length - 1;
      score += Math.min(matches, 5);
    }
    if (row.language === language) score += 2;
    else if (row.language === "both") score += 1;
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      language: row.language,
      categoryName: language === "ar" ? row.categoryNameAr : row.categoryNameEn,
      score,
    };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 4);
}

export async function countPublishedKnowledge(): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)::int` }).from(knowledgeArticles).where(eq(knowledgeArticles.status, "PUBLISHED"));
  return rows[0]?.count ?? 0;
}

export async function listKnowledgeCategories() {
  return db.select().from(knowledgeCategories).orderBy(knowledgeCategories.nameEn);
}

export async function createKnowledgeCategory(input: { key: string; nameEn: string; nameAr: string }) {
  const id = crypto.randomUUID();
  const [existing] = await db.select({ id: knowledgeCategories.id }).from(knowledgeCategories).where(eq(knowledgeCategories.key, input.key)).limit(1);
  if (existing) return existing.id;
  await db.insert(knowledgeCategories).values({ id, ...input });
  return id;
}
