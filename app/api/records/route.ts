import { requireLegacyRuntime, jsonError } from "../learning/_shared";
import { desc, isNull } from "drizzle-orm";
import { getDb } from "../../../db";
import { records } from "../../../db/schema";
import { normalizeHorizon, starterRecords } from "../../../lib/trellis";

const allowedTypes = new Set(["goal", "project", "task", "resource", "artifact", "evidence", "review", "idea"]);
const allowedLines = new Set(["G", "J", "B", "I"]);
const allowedStatuses = new Set(["active", "near", "later", "paused", "done", "proposal"]);

export async function GET(request: Request) {
  try {
    await requireLegacyRuntime(request);
    const db = await getDb();
    // D1 limits the number of bound parameters in one statement. Each starter
    // record supplies many columns, so inserting the full route map at once
    // exceeds that limit even though smaller concept-card seeds succeed.
    for (let index = 0; index < starterRecords.length; index += 3) {
      await db.insert(records)
        .values(starterRecords.slice(index, index + 3))
        .onConflictDoNothing();
    }
    const rows = await db.select().from(records).where(isNull(records.deletedAt)).orderBy(desc(records.updatedAt));
    return Response.json({
      records: rows
        .filter((row) => (row.recordType === "task" || row.recordType === "artifact") && !/^T-0[1-5]$/.test(row.id))
        .map((row) => ({ ...row, status: normalizeHorizon(row.status) })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireLegacyRuntime(request);
    const payload = await request.json() as Record<string, unknown>;
    const title = String(payload.title ?? "").trim();
    const recordType = String(payload.recordType ?? "task");
    const line = String(payload.line ?? "");
    const status = String(payload.status ?? "near");
    if (!title || !allowedTypes.has(recordType)) {
      return Response.json({ error:"标题和有效记录类型为必填项" }, { status:400 });
    }
    if (!allowedLines.has(line) || !allowedStatuses.has(status)) {
      return Response.json({ error:"主线或状态无效" }, { status:400 });
    }

    const estimatedMinutes = Math.max(15, Math.round((Number(payload.estimatedMinutes) || 15) / 15) * 15);
    const db = await getDb();
    const [record] = await db.insert(records).values({
      id: crypto.randomUUID(),
      title,
      recordType: recordType as typeof records.$inferInsert.recordType,
      line: line as typeof records.$inferInsert.line,
      module: String(payload.module ?? ""),
      projectId: String(payload.projectId ?? ""),
      scheduleRole: (payload.scheduleRole ?? "support") as typeof records.$inferInsert.scheduleRole,
      status: status as typeof records.$inferInsert.status,
      estimatedMinutes,
      actualMinutes: Math.max(0, Number(payload.actualMinutes) || 0),
      coreAction: String(payload.coreAction ?? ""),
      learningScope: String(payload.learningScope ?? ""),
      executionMethod: String(payload.executionMethod ?? "明确结果 → 打开核心资料 → 完成最小动作 → 保存证据"),
      completionCriteria: String(payload.completionCriteria ?? "留下一个可打开或可描述的结果。"),
      evidence: String(payload.evidence ?? ""),
      blockers: String(payload.blockers ?? ""),
      nextStep: String(payload.nextStep ?? "打开任务并完成第一步。"),
      aiReview: String(payload.aiReview ?? ""),
      sourceUrl: payload.sourceUrl ? String(payload.sourceUrl) : null,
      notes: String(payload.notes ?? ""),
    }).returning();
    return Response.json({ record }, { status:201 });
  } catch (error) {
    return jsonError(error);
  }
}
