import { requireLegacyRuntime, jsonError } from "../learning/_shared";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../db";
import { records } from "../../../db/schema";
import { starterConcepts } from "../../../lib/trellis";

function toCard(row:typeof records.$inferSelect) {
  return {
    id:row.id,
    title:row.title,
    module:row.module ?? "",
    officialDefinition:row.coreAction,
    plainExplanation:row.learningScope,
    example:row.executionMethod,
    misconception:row.blockers,
    sourceUrl:row.sourceUrl ?? "",
    familiar:row.acceptance === "passed",
  };
}

export async function GET(request: Request) {
  try {
    await requireLegacyRuntime(request);
    const db = await getDb();
    await db.insert(records).values(starterConcepts.map((card) => ({
      id:card.id,
      title:card.title,
      recordType:"resource" as const,
      line:"G" as const,
      module:card.module,
      projectId:"概念闪卡",
      scheduleRole:"maintain" as const,
      status:"later" as const,
      coreAction:card.officialDefinition,
      learningScope:card.plainExplanation,
      executionMethod:card.example,
      completionCriteria:"能够用自己的话解释，并判断一个正例和一个常见误区。",
      evidence:"",
      blockers:card.misconception,
      nextStep:"先回忆，再展开卡片核对官方解释。",
      aiReview:"",
      acceptance:card.familiar ? "passed" as const : "unreviewed" as const,
      sourceUrl:card.sourceUrl,
    }))).onConflictDoNothing();
    const rows = await db.select().from(records)
      .where(and(eq(records.recordType,"resource"),isNull(records.deletedAt)))
      .orderBy(asc(records.title));
    return Response.json({ concepts:rows.map(toCard) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request:Request) {
  try {
    await requireLegacyRuntime(request);
    const payload = await request.json() as Record<string,unknown>;
    const title = String(payload.title ?? "").trim();
    const officialDefinition = String(payload.officialDefinition ?? "").trim();
    const sourceUrl = String(payload.sourceUrl ?? "").trim();
    if (!title || !officialDefinition || !sourceUrl) {
      return Response.json({error:"概念、官方解释和官方来源为必填项"},{status:400});
    }
    const db = await getDb();
    const [row] = await db.insert(records).values({
      id:crypto.randomUUID(),
      title,
      recordType:"resource",
      line:"G",
      module:String(payload.module ?? "G5 · LLM 应用工程"),
      projectId:"概念闪卡",
      scheduleRole:"maintain",
      status:"later",
      coreAction:officialDefinition,
      learningScope:String(payload.plainExplanation ?? ""),
      executionMethod:String(payload.example ?? ""),
      completionCriteria:"能够用自己的话解释，并判断一个正例和一个常见误区。",
      blockers:String(payload.misconception ?? ""),
      nextStep:"先回忆，再展开卡片核对官方解释。",
      sourceUrl,
    }).returning();
    return Response.json({concept:toCard(row)},{status:201});
  } catch (error) {
    return jsonError(error);
  }
}
