import { requireLegacyRuntime, jsonError } from "../../learning/_shared";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { records } from "../../../../db/schema";

const statuses = new Set(["active", "near", "later", "paused", "done", "proposal"]);
const editableFields = new Set([
  "title", "line", "module", "projectId", "scheduleRole", "status",
  "estimatedMinutes", "actualMinutes", "coreAction", "learningScope",
  "executionMethod", "completionCriteria", "evidence", "blockers",
  "nextStep", "aiReview", "acceptance", "sourceUrl", "notes",
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLegacyRuntime(request);
    const { id } = await context.params;
    const payload = await request.json() as Record<string, unknown>;
    if (payload.status !== undefined && !statuses.has(String(payload.status))) {
      return Response.json({ error:"无效状态" }, { status:400 });
    }
    const changes = Object.fromEntries(
      Object.entries(payload).filter(([key]) => editableFields.has(key))
    ) as Partial<typeof records.$inferInsert>;
    if (Object.keys(changes).length === 0) {
      return Response.json({ error:"没有可更新字段" }, { status:400 });
    }
    if (changes.estimatedMinutes !== undefined) {
      changes.estimatedMinutes = Math.max(15, Math.round((Number(changes.estimatedMinutes) || 15) / 15) * 15);
    }
    if (changes.actualMinutes !== undefined) {
      changes.actualMinutes = Math.max(0, Number(changes.actualMinutes) || 0);
    }

    const db = await getDb();
    const [record] = await db.update(records)
      .set({ ...changes, updatedAt:new Date().toISOString() })
      .where(eq(records.id,id))
      .returning();
    return record
      ? Response.json({ record })
      : Response.json({ error:"记录不存在" }, { status:404 });
  } catch (error) {
    return jsonError(error);
  }
}
