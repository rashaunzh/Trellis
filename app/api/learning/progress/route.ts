import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { learningMvpStates, learningPathProposals } from "../../../../db/schema";
import { 单用户OwnerId, 安全解析Json, 稳定Id } from "../../../../lib/learning-server";

async function 当前进度() {
  const db = await getDb();
  const [state] = await db.select().from(learningMvpStates).where(eq(learningMvpStates.ownerId, 单用户OwnerId)).limit(1);
  if (!state) return { progress:null };
  return {
    progress:{
      ...state,
      completedActivities:安全解析Json<string[]>(state.completedActivitiesJson, []),
      evidence:安全解析Json<Record<string,string>>(state.evidenceJson, {}),
      reviewAnswers:安全解析Json<Record<string,string>>(state.reviewAnswersJson, {}),
    },
  };
}

export async function GET() {
  try { return Response.json(await 当前进度()); }
  catch (error) { return Response.json({ error:error instanceof Error ? error.message : "读取学习进度失败" }, { status:500 }); }
}

export async function PUT(request:Request) {
  try {
    const payload = await request.json() as Record<string,unknown>;
    const proposalId = String(payload.proposalId ?? "");
    if (!proposalId) return Response.json({ error:"缺少已确认的学习路径" }, { status:400 });
    const db = await getDb();
    const [proposal] = await db.select().from(learningPathProposals).where(eq(learningPathProposals.id,proposalId)).limit(1);
    if (!proposal || proposal.ownerId !== 单用户OwnerId || proposal.status !== "confirmed") {
      return Response.json({ error:"学习路径尚未确认" }, { status:409 });
    }
    const completedActivities = Array.isArray(payload.completedActivities) ? payload.completedActivities.map(String).slice(0,100) : [];
    const evidence = payload.evidence && typeof payload.evidence === "object" ? payload.evidence : {};
    const reviewAnswers = payload.reviewAnswers && typeof payload.reviewAnswers === "object" ? payload.reviewAnswers : {};
    const values = {
      proposalId,
      activeCapabilityId:String(payload.activeCapabilityId ?? "mechanism").slice(0,80),
      completedActivitiesJson:JSON.stringify(completedActivities),
      evidenceJson:JSON.stringify(evidence),
      reviewAnswersJson:JSON.stringify(reviewAnswers),
      updatedAt:new Date().toISOString(),
    };
    await db.insert(learningMvpStates).values({
      id:稳定Id("learning-state",单用户OwnerId), ownerId:单用户OwnerId, ...values,
    }).onConflictDoUpdate({ target:learningMvpStates.ownerId, set:values });
    return Response.json(await 当前进度());
  } catch (error) { return Response.json({ error:error instanceof Error ? error.message : "保存学习进度失败" }, { status:500 }); }
}
