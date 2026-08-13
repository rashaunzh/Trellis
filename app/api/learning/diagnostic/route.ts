import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { learningDiagnostics, learningPathItems, learningPathProposals } from "../../../../db/schema";
import { AI通识V1, 计算诊断, 生成路径, type 诊断答案 } from "../../../../lib/ai-literacy-v1";
import { 单用户OwnerId, 安全解析Json, 稳定Id } from "../../../../lib/learning-server";

async function 当前状态() {
  const db = await getDb();
  const [diagnostic] = await db.select().from(learningDiagnostics).where(and(
    eq(learningDiagnostics.ownerId, 单用户OwnerId),
    eq(learningDiagnostics.contentPackId, AI通识V1.id),
    eq(learningDiagnostics.contentPackVersion, AI通识V1.版本),
  )).limit(1);
  if (!diagnostic) return { diagnostic:null, proposal:null, items:[] };
  const [proposal] = await db.select().from(learningPathProposals).where(and(
    eq(learningPathProposals.diagnosticId, diagnostic.id),
    eq(learningPathProposals.contentPackVersion, AI通识V1.版本),
  )).limit(1);
  const items = proposal
    ? await db.select().from(learningPathItems).where(eq(learningPathItems.proposalId, proposal.id)).orderBy(learningPathItems.sequence)
    : [];
  return {
    diagnostic:{
      ...diagnostic,
      selfReport:安全解析Json(diagnostic.selfReportJson, {}),
      materials:安全解析Json(diagnostic.materialsJson, []),
      answers:安全解析Json(diagnostic.answersJson, {}),
      scores:安全解析Json(diagnostic.scoresJson, {}),
    },
    proposal:proposal ?? null,
    items,
  };
}

export async function GET() {
  try { return Response.json(await 当前状态()); }
  catch (error) { return Response.json({ error:error instanceof Error ? error.message : "读取诊断失败" }, { status:500 }); }
}

export async function PUT(request:Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const answers = (payload.answers && typeof payload.answers === "object" ? payload.answers : {}) as 诊断答案;
    const materials = Array.isArray(payload.materials) ? payload.materials.map(String).filter(Boolean).slice(0, 20) : [];
    const weeklyMinutes = Math.min(720, Math.max(30, Math.round((Number(payload.weeklyMinutes) || 180) / 15) * 15));
    const id = 稳定Id("diagnostic", `${单用户OwnerId}:${AI通识V1.id}:${AI通识V1.版本}`);
    const db = await getDb();
    await db.insert(learningDiagnostics).values({
      id, ownerId:单用户OwnerId, contentPackId:AI通识V1.id, contentPackVersion:AI通识V1.版本,
      goal:String(payload.goal ?? "").trim().slice(0, 1000), weeklyMinutes,
      selfReportJson:JSON.stringify(payload.selfReport ?? {}), materialsJson:JSON.stringify(materials),
      answersJson:JSON.stringify(answers), scoresJson:"{}", status:"draft", updatedAt:new Date().toISOString(),
    }).onConflictDoUpdate({ target:learningDiagnostics.id, set:{
      goal:String(payload.goal ?? "").trim().slice(0, 1000), weeklyMinutes,
      selfReportJson:JSON.stringify(payload.selfReport ?? {}), materialsJson:JSON.stringify(materials),
      answersJson:JSON.stringify(answers), status:"draft", updatedAt:new Date().toISOString(),
    }});
    return Response.json(await 当前状态());
  } catch (error) { return Response.json({ error:error instanceof Error ? error.message : "保存诊断失败" }, { status:500 }); }
}

export async function POST(request:Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const answers = (payload.answers && typeof payload.answers === "object" ? payload.answers : {}) as 诊断答案;
    const missing = AI通识V1.诊断题.filter((question) => !answers[question.id]);
    if (!String(payload.goal ?? "").trim() || missing.length) {
      return Response.json({ error:"请填写学习诉求并完成全部诊断题" }, { status:400 });
    }
    const diagnosticId = 稳定Id("diagnostic", `${单用户OwnerId}:${AI通识V1.id}:${AI通识V1.版本}`);
    const proposalId = 稳定Id("proposal", `${diagnosticId}:${AI通识V1.版本}`);
    const scores = 计算诊断(answers);
    const path = 生成路径(scores);
    const weeklyMinutes = Math.min(720, Math.max(30, Math.round((Number(payload.weeklyMinutes) || 180) / 15) * 15));
    const materials = Array.isArray(payload.materials) ? payload.materials.map(String).filter(Boolean).slice(0, 20) : [];
    const db = await getDb();
    await db.insert(learningDiagnostics).values({
      id:diagnosticId, ownerId:单用户OwnerId, contentPackId:AI通识V1.id, contentPackVersion:AI通识V1.版本,
      goal:String(payload.goal).trim().slice(0, 1000), weeklyMinutes,
      selfReportJson:JSON.stringify(payload.selfReport ?? {}), materialsJson:JSON.stringify(materials),
      answersJson:JSON.stringify(answers), scoresJson:JSON.stringify(scores), status:"submitted", updatedAt:new Date().toISOString(),
    }).onConflictDoUpdate({ target:learningDiagnostics.id, set:{
      goal:String(payload.goal).trim().slice(0, 1000), weeklyMinutes,
      selfReportJson:JSON.stringify(payload.selfReport ?? {}), materialsJson:JSON.stringify(materials),
      answersJson:JSON.stringify(answers), scoresJson:JSON.stringify(scores), status:"submitted", updatedAt:new Date().toISOString(),
    }});
    await db.insert(learningPathProposals).values({
      id:proposalId, ownerId:单用户OwnerId, diagnosticId, contentPackVersion:AI通识V1.版本,
      explanation:"路径由诊断表现和能力前置关系确定。自报与材料只调整支架，不降低毕业标准；确认前不会成为正式路径。",
    }).onConflictDoUpdate({ target:learningPathProposals.id, set:{
      status:"pending",
      explanation:"路径由诊断表现和能力前置关系确定。自报与材料只调整支架，不降低毕业标准；确认前不会成为正式路径。",
      updatedAt:new Date().toISOString(),
    }});
    for (const item of path) {
      await db.insert(learningPathItems).values({
        id:稳定Id("path-item", `${proposalId}:${item.capabilityId}`), proposalId, ...item,
      }).onConflictDoUpdate({ target:learningPathItems.id, set:{ ...item } });
    }
    return Response.json(await 当前状态());
  } catch (error) { return Response.json({ error:error instanceof Error ? error.message : "提交诊断失败" }, { status:500 }); }
}
