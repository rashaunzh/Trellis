import { desc, isNull } from "drizzle-orm";
import { getDb } from "../../../db";
import { records } from "../../../db/schema";

const allowedTypes = new Set(["goal", "project", "task", "resource", "artifact", "evidence", "review", "idea"]);

const seedRecords: (typeof records.$inferInsert)[] = [
  { id:"T-01", title:"完成 Notebook 测评方法与测试集复核", recordType:"task", line:"J", projectId:"Notebook 专业测评", scheduleRole:"focus", status:"in_progress", estimatedMinutes:180, coreAction:"逐条核对测试任务的来源、版本、标准答案和证据，并冻结首批可执行测试集。", learningScope:"先处理 L1–L3；聚焦事实问答、无答案拒答、跨来源综合与引用定位。L4/L5 暂不进入本轮。", executionMethod:"先审测试集字段完整性，再用 2–3 条样例走通输入、输出、评分和 Bad Case 记录。", completionCriteria:"测试集来源、版本、答案与证据均可追溯；第三方可按说明复现；不存在只靠主观判断的评分项。", evidence:"待补：测试集仓库链接与复核记录", blockers:"需先确认竞品统一输入条件。", nextStep:"冻结测试集后开始执行 T02 事实题和 T03 无答案题。", aiReview:"未初评：提交证据后再生成初评。" },
  { id:"T-02", title:"梳理目标 JD 的核心能力要求", recordType:"task", line:"J", projectId:"求职准备", scheduleRole:"focus", status:"this_week", estimatedMinutes:120, coreAction:"收集 20 个目标岗位 JD，提取职责、能力和技术关键词，并识别自己的证据缺口。", learningScope:"企业服务 AI 产品经理、AI 解决方案产品经理及相邻岗位。", executionMethod:"统一岗位样本口径 → 关键词归一 → 聚类 → 形成能力要求与作品证据映射。", completionCriteria:"形成岗位能力词频、岗位共性要求、个人差距和补齐动作四部分。", evidence:"待补：JD 样本表与分析文档", blockers:"目标公司与岗位范围尚需持续校准。", nextStep:"将高频能力要求映射到三项作品与面试故事。", aiReview:"未初评。" },
  { id:"T-03", title:"学习 Eval 指标与 Bad Case 归因", recordType:"task", line:"G", projectId:"Notebook 专业测评", scheduleRole:"support", status:"in_progress", estimatedMinutes:120, coreAction:"理解 Recall@K、引用可核验率、拒答率、冲突识别率等指标，并落实到测评表。", learningScope:"只学习当前 Notebook 测评会实际使用的指标，不扩展到完整模型评测课程。", executionMethod:"概念解释 → 计算示例 → 适用边界 → 对应测试任务 → Bad Case 标签。", completionCriteria:"能独立解释指标、写出计算方式，并给至少一条正确和一条失败样例。", evidence:"待补：指标字典与示例", blockers:"部分延迟指标需要产品日志或重复人工计时。", nextStep:"把指标定义写入测试执行说明。", aiReview:"未初评。" },
  { id:"T-04", title:"输出一篇测评方法复盘", recordType:"artifact", line:"B", projectId:"内容实验", scheduleRole:"maintain", status:"pending_review", estimatedMinutes:60, coreAction:"把测试集、测试方法和评分指标的设计过程整理为新手可理解的公开内容。", learningScope:"只解释一次完整测评闭环，不展开全部技术架构。", executionMethod:"问题切入 → 常见错误 → 专业方法 → Notebook 示例 → 可复用模板。", completionCriteria:"形成可公开发布的结构化内容；读者能据此判断一份测评是否可复现。", evidence:"待补：内容草稿链接", blockers:"需先完成一组真实测试，避免内容只有方法没有结果。", nextStep:"完成首组测试后补充真实截图与 Bad Case。", aiReview:"待证据：当前有结构，但缺真实结果支撑。" },
  { id:"T-05", title:"筛选企业知识库开源底座", recordType:"task", line:"I", projectId:"企业知识库", scheduleRole:"candidate", status:"backlog", estimatedMinutes:120, coreAction:"建立候选池并判断哪些成熟代码适合改造成企业级知识库作品。", learningScope:"重点比较权限、文档解析、RAG、引用、反馈、评测和二次开发成本。", executionMethod:"先定义作品差异化，再筛 3–5 个候选底座，不做无目的部署。", completionCriteria:"形成候选底座对比，并明确首选、备选及不选原因。", evidence:"待补：开源底座对比表", blockers:"当前仍是候选，不得挤占求职和 Notebook 主攻时间。", nextStep:"基于目标 JD 确认平台型作品需要证明的能力。", aiReview:"未初评。" },
];

export async function GET() {
  try {
    const db = await getDb();
    let rows = await db.select().from(records).where(isNull(records.deletedAt)).orderBy(desc(records.updatedAt));
    if (rows.length === 0) {
      await db.insert(records).values(seedRecords).onConflictDoNothing();
      rows = await db.select().from(records).where(isNull(records.deletedAt)).orderBy(desc(records.updatedAt));
    }
    return Response.json({ records: rows });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取记录失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { title?:string; recordType?:string; line?:"G"|"J"|"B"|"I"; projectId?:string; completionCriteria?:string; estimatedMinutes?:number; scheduleRole?:"focus"|"support"|"maintain"|"candidate"; coreAction?:string; learningScope?:string; executionMethod?:string; evidence?:string; blockers?:string; nextStep?:string; aiReview?:string; sourceUrl?:string|null };
    const title = payload.title?.trim() ?? "";
    if (!title || !payload.recordType || !allowedTypes.has(payload.recordType)) return Response.json({ error:"标题和有效记录类型为必填项" }, { status:400 });
    const id = crypto.randomUUID();
    const db = await getDb();
    const [record] = await db.insert(records).values({ id, title, recordType: payload.recordType as typeof records.$inferInsert.recordType, line: payload.line, projectId: payload.projectId, completionCriteria: payload.completionCriteria ?? "", estimatedMinutes: Math.max(0, Number(payload.estimatedMinutes) || 0), scheduleRole: payload.scheduleRole ?? "candidate", status:"this_week", coreAction:payload.coreAction ?? "", learningScope:payload.learningScope ?? "", executionMethod:payload.executionMethod ?? "", evidence:payload.evidence ?? "", blockers:payload.blockers ?? "", nextStep:payload.nextStep ?? "", aiReview:payload.aiReview ?? "", sourceUrl:payload.sourceUrl ?? null }).returning();
    return Response.json({ record }, { status:201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "创建记录失败" }, { status:500 });
  }
}
