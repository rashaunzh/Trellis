import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { learningPathProposals } from "../../../../db/schema";
import { 单用户OwnerId } from "../../../../lib/learning-server";

export async function PATCH(request:Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const id = String(payload.id ?? "");
    const status = String(payload.status ?? "");
    if (!id || !["confirmed","rejected"].includes(status)) return Response.json({ error:"提案和操作无效" }, { status:400 });
    const db = await getDb();
    const [proposal] = await db.update(learningPathProposals).set({
      status:status as "confirmed" | "rejected", updatedAt:new Date().toISOString(),
    }).where(and(eq(learningPathProposals.id,id),eq(learningPathProposals.ownerId,单用户OwnerId))).returning();
    if (!proposal) return Response.json({ error:"未找到路径提案" }, { status:404 });
    return Response.json({ proposal });
  } catch (error) { return Response.json({ error:error instanceof Error ? error.message : "更新提案失败" }, { status:500 }); }
}
