import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { records } from "../../../../db/schema";

const statuses = new Set(["backlog", "this_week", "in_progress", "pending_review", "done"]);
const editableFields = new Set(["title", "line", "projectId", "scheduleRole", "status", "estimatedMinutes", "coreAction", "learningScope", "executionMethod", "completionCriteria", "evidence", "blockers", "nextStep", "aiReview", "acceptance", "sourceUrl", "notes"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = await request.json() as Record<string, unknown>;
    if (payload.status !== undefined && (!payload.status || !statuses.has(String(payload.status)))) return Response.json({ error:"无效状态" }, { status:400 });
    const changes = Object.fromEntries(Object.entries(payload).filter(([key]) => editableFields.has(key))) as Partial<typeof records.$inferInsert>;
    if (Object.keys(changes).length === 0) return Response.json({ error:"没有可更新字段" }, { status:400 });
    if (changes.estimatedMinutes !== undefined) changes.estimatedMinutes = Math.max(0, Number(changes.estimatedMinutes) || 0);
    const db = await getDb();
    const [record] = await db.update(records).set({ ...changes, updatedAt:new Date().toISOString() }).where(eq(records.id,id)).returning();
    return record ? Response.json({ record }) : Response.json({ error:"记录不存在" }, { status:404 });
  } catch (error) {
    return Response.json({ error:error instanceof Error ? error.message : "更新失败" }, { status:500 });
  }
}
