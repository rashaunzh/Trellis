// 固定合成目标、同一发布目录，比较 Trellis 与简单提示词；人工量规评分另做。
import { loadEnvFile } from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { InMemoryCourseIntelligenceRepository } from "../../lib/learning/intelligence/repository.ts";
import { CourseIntelligenceModelGateway, builtInModelConfig } from "../../lib/learning/intelligence/model-gateway.ts";
import { CourseIntelligenceService } from "../../lib/learning/intelligence/service.ts";
try { loadEnvFile(".env.local"); } catch (error) { if (error.code !== "ENOENT") throw error; }
const config = builtInModelConfig(process.env);
if (!config) throw new Error("缺少模型配置；不生成虚构比较结果");
const repository = new InMemoryCourseIntelligenceRepository();
const gateway = new CourseIntelligenceModelGateway(repository, { primary: config.primary, fallback: null });
const service = new CourseIntelligenceService(repository, gateway);
await service.initialize();
const courses = await repository.listCourses();
const schema = z.object({ rationale: z.string(), steps: z.array(z.object({ courseId: z.string(), unitId: z.string(), reason: z.string(), action: z.string(), minutes: z.number() })), gaps: z.array(z.string()) });
const prompt = "请根据用户目标和每周时间，从给定目录选择适合的学习章节，按先后顺序给出课程、章节、理由、具体行动和预计分钟，并说明缺口。只使用给定课程和章节。输出符合JSON schema的对象。";
const tasks = [
  { id: "R1", goal: "没有编程基础，每周两小时学习 AI 产品判断" },
  { id: "R2", goal: "仅采用 DeepLearning.AI 的课程，学习 AI 产品评估；缺口请说明" },
  { id: "R3", goal: "已经开始 AI 基础，希望下一阶段理解 Agent 的产品边界" },
  { id: "R4", goal: "我实际每周只能投入30分钟，希望从零学会全部AI产品工作", limitation: "界面容量档位最低两小时，本例检验是否明确暴露冲突" },
  { id: "R5", goal: "想做 AI 学习助手，优先学习问题定义、评估和成本，不训练模型" },
];
await mkdir("outputs/week-delivery", { recursive: true });
const cases = [];
for (const task of tasks) {
  const intake = { goal: task.goal, weeklyCapacity: "light", materials: [] };
  const started = Date.now();
  let route = null;
  let systemError = null;
  try { route = await service.createCurriculum(`comparison-${task.id}`, intake); }
  catch (error) { systemError = { message: error.message, status: error.status ?? 500 }; }
  const systemMs = Date.now() - started;
  const simple = await gateway.structuredDetailed({ ownerId: `baseline-${task.id}`, kind: "portfolio_route_baseline", contractVersion: "week-comparison.v1", system: prompt,
    data: { goal: task.goal, weeklyMinutes: 120, courses: courses.map(({ genome }) => ({ id: genome.id, title: genome.title, units: genome.units.map(unit => ({ id: unit.id, title: unit.title })) })) }, schema, bypassCache: true,
  });
  cases.push({ ...task, scope: "合成目标的路线比较；不替代原12例的完整状态和材料测试", intake, system: route?.assembly ?? null, systemError, systemMs, simple: simple.value, resolution: simple.resolution,
    baselineLatencyMs: simple.attempts.reduce((sum,item)=>sum+item.latencyMs,0), baselineTokens: simple.attempts.reduce((sum,item)=>sum+item.promptTokens+item.completionTokens,0), humanScores: null });
  console.log(`${task.id}: system ${systemError ? "constraint rejected" : "generated"}; baseline ${simple.resolution}`);
  await writeFile("outputs/week-delivery/route-comparison.json", JSON.stringify({ generatedAt: new Date().toISOString(), promptVersion: "week-comparison.v1", prompt, model: config.primary.model, cases, verdict: "等待盲评：不得根据生成成功宣称质量胜出" }, null, 2));
}
