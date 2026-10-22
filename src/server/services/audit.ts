import { db } from "@/server/db/client";
import { auditLogs } from "@/server/db/schema";

export type AuditEntry = {
  actorUserId?: string | null;
  /** Email of the admin, "device:<id>", "simulator", "system" or "anonymous". */
  actorLabel: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

/**
 * Append-only audit trail for security-sensitive activity.
 * Callers must never place secrets or unnecessary personal data in `metadata`.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actorUserId: entry.actorUserId ?? null,
      actorLabel: entry.actorLabel.slice(0, 120),
      action: entry.action.slice(0, 80),
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata ?? {},
      ip: entry.ip ?? null,
    });
  } catch (error) {
    // Auditing must never break the user's request, but the failure is surfaced to logs.
    console.error("[audit] failed to write audit log:", error instanceof Error ? error.message : error);
  }
}
