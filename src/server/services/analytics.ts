import { and, desc, eq, gt, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  auditLogs,
  conversations,
  deviceEvents,
  knowledgeArticles,
  robotCommands,
  robotDevices,
  sessions,
  studentCards,
  students,
  campusLocations,
} from "@/server/db/schema";
import { getCommandStats } from "./commands";
import { messageSeries } from "./conversations";

export type OverviewMetrics = {
  students: { total: number; active: number };
  cards: { total: number; active: number; revoked: number };
  devices: { total: number; online: number; simulated: number };
  locations: { published: number; navigable: number; total: number };
  knowledge: { published: number; total: number };
  conversations: { total: number; last30Days: number };
  commands: { total: number; completed: number; failed: number; pending: number; successRate: number };
  events: { total: number; last24h: number };
};

/** Real, database-backed metrics for the admin overview (no hardcoded sample numbers). */
export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  const since24h = new Date(Date.now() - 86_400_000);
  const since30d = new Date(Date.now() - 30 * 86_400_000);

  const [studentsRow, cardsRow, devicesRow, locationsRow, knowledgeRow, conversationsRow, eventsRow, commandStats] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int`, active: sql<number>`count(*) filter (where ${students.status} = 'ACTIVE')::int` }).from(students),
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${studentCards.status} = 'ACTIVE')::int`,
        revoked: sql<number>`count(*) filter (where ${studentCards.status} = 'REVOKED')::int`,
      })
      .from(studentCards),
    db
      .select({
        total: sql<number>`count(*)::int`,
        simulated: sql<number>`count(*) filter (where ${robotDevices.simulated})::int`,
      })
      .from(robotDevices),
    db
      .select({
        total: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${campusLocations.published})::int`,
        navigable: sql<number>`count(*) filter (where ${campusLocations.navigable})::int`,
      })
      .from(campusLocations),
    db
      .select({
        total: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${knowledgeArticles.status} = 'PUBLISHED')::int`,
      })
      .from(knowledgeArticles),
    db.select({ total: sql<number>`count(*)::int`, recent: sql<number>`count(*) filter (where ${conversations.updatedAt} >= ${since30d})::int` }).from(conversations),
    db
      .select({ total: sql<number>`count(*)::int`, recent: sql<number>`count(*) filter (where ${deviceEvents.createdAt} >= ${since24h})::int` })
      .from(deviceEvents),
    getCommandStats(),
  ]);

  const devices = await db.select({ status: robotDevices.status, lastSeenAt: robotDevices.lastSeenAt }).from(robotDevices);
  const online = devices.filter(
    (d) => d.status !== "OFFLINE" && d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < 45_000,
  ).length;

  const commandBreakdown = await db
    .select({ status: robotCommands.status, count: sql<number>`count(*)::int` })
    .from(robotCommands)
    .groupBy(robotCommands.status);

  const byStatus = Object.fromEntries(commandBreakdown.map((r) => [r.status, r.count]));

  return {
    students: { total: studentsRow[0]?.total ?? 0, active: studentsRow[0]?.active ?? 0 },
    cards: { total: cardsRow[0]?.total ?? 0, active: cardsRow[0]?.active ?? 0, revoked: cardsRow[0]?.revoked ?? 0 },
    devices: { total: devicesRow[0]?.total ?? 0, online, simulated: devicesRow[0]?.simulated ?? 0 },
    locations: { total: locationsRow[0]?.total ?? 0, published: locationsRow[0]?.published ?? 0, navigable: locationsRow[0]?.navigable ?? 0 },
    knowledge: { total: knowledgeRow[0]?.total ?? 0, published: knowledgeRow[0]?.published ?? 0 },
    conversations: { total: conversationsRow[0]?.total ?? 0, last30Days: conversationsRow[0]?.recent ?? 0 },
    commands: {
      total: commandStats.total,
      completed: byStatus.COMPLETED ?? 0,
      failed: byStatus.FAILED ?? 0,
      pending: (byStatus.PENDING ?? 0) + (byStatus.SENT ?? 0) + (byStatus.EXECUTING ?? 0),
      successRate: commandStats.successRate,
    },
    events: { total: eventsRow[0]?.total ?? 0, last24h: eventsRow[0]?.recent ?? 0 },
  };
}

export type RangeSeries = {
  days: number;
  messages: Array<{ day: string; user: number; assistant: number }>;
  commands: Array<{ day: string; completed: number; failed: number; total: number }>;
  conversations: Array<{ day: string; count: number }>;
};

/** Time series for the dashboard charts (counts only — no conversation content). */
export async function getRangeSeries(days = 14): Promise<RangeSeries> {
  const since = new Date(Date.now() - days * 86_400_000);

  const [messages, commandRows, conversationRows] = await Promise.all([
    messageSeries(days),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${robotCommands.createdAt}), 'YYYY-MM-DD')`,
        status: robotCommands.status,
        count: sql<number>`count(*)::int`,
      })
      .from(robotCommands)
      .where(gte(robotCommands.createdAt, since))
      .groupBy(sql`date_trunc('day', ${robotCommands.createdAt})`, robotCommands.status)
      .orderBy(sql`1`),
    db
      .select({ day: sql<string>`to_char(date_trunc('day', ${conversations.createdAt}), 'YYYY-MM-DD')`, count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(gte(conversations.createdAt, since))
      .groupBy(sql`date_trunc('day', ${conversations.createdAt})`)
      .orderBy(sql`1`),
  ]);

  const commandMap = new Map<string, { completed: number; failed: number; total: number }>();
  for (const row of commandRows) {
    const entry = commandMap.get(row.day) ?? { completed: 0, failed: 0, total: 0 };
    entry.total += row.count;
    if (row.status === "COMPLETED") entry.completed += row.count;
    if (row.status === "FAILED") entry.failed += row.count;
    commandMap.set(row.day, entry);
  }

  return {
    days,
    messages,
    commands: [...commandMap.entries()].map(([day, v]) => ({ day, ...v })),
    conversations: conversationRows.map((r) => ({ day: r.day, count: r.count })),
  };
}

export type SecurityOverview = {
  recentAudit: Array<{
    id: string;
    actorLabel: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    ip: string | null;
    createdAt: Date;
  }>;
  loginFailures24h: number;
  activeSessions: number;
  revokedCards: number;
  events24h: number;
};

/** Security page data: audit trail + counters (access-controlled, never public). */
export async function getSecurityOverview(limit = 50): Promise<SecurityOverview> {
  const since24h = new Date(Date.now() - 86_400_000);
  const [auditRows, failures, activeSessions, revoked, events] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        actorLabel: auditLogs.actorLabel,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        ip: auditLogs.ip,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(and(eq(auditLogs.action, "auth.login.failed"), gte(auditLogs.createdAt, since24h))),
    db.select({ count: sql<number>`count(*)::int` }).from(sessions).where(and(isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()))),
    db.select({ count: sql<number>`count(*)::int` }).from(studentCards).where(eq(studentCards.status, "REVOKED")),
    db.select({ count: sql<number>`count(*)::int` }).from(deviceEvents).where(gte(deviceEvents.createdAt, since24h)),
  ]);

  return {
    recentAudit: auditRows,
    loginFailures24h: failures[0]?.count ?? 0,
    activeSessions: activeSessions[0]?.count ?? 0,
    revokedCards: revoked[0]?.count ?? 0,
    events24h: events[0]?.count ?? 0,
  };
}
