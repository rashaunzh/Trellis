import { InMemoryLearningStore } from "../../lib/learning/persistence/in-memory.ts";
import { InMemoryCourseIntelligenceRepository } from "../../lib/learning/intelligence/repository.ts";
import { CourseIntelligenceModelGateway } from "../../lib/learning/intelligence/model-gateway.ts";
import { CourseIntelligenceService } from "../../lib/learning/intelligence/service.ts";

const apiKey = process.env.TRELLIS_AI_API_KEY?.trim();
const model = process.env.TRELLIS_AI_MODEL?.trim();
const requireBenchmark = process.env.TRELLIS_REQUIRE_MODEL_BENCHMARK === "1";

if (!apiKey || !model) {
  const message = "SKIP real model benchmark: TRELLIS_AI_API_KEY/TRELLIS_AI_MODEL not set";
  if (requireBenchmark) {
    console.error(message);
    process.exit(1);
  }
  console.log(message);
  process.exit(0);
}

const repository = new InMemoryCourseIntelligenceRepository();
const gateway = new CourseIntelligenceModelGateway(repository, {
  apiKey,
  model,
  baseUrl: (process.env.TRELLIS_AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
});
const service = new CourseIntelligenceService(repository, gateway, new InMemoryLearningStore());
await service.initialize();

const cases = [
  { name: "AI 通识", goal: "理解生成式 AI 的能力边界，能够可靠地使用和判断输出" },
  { name: "AI PM", goal: "判断 Agent 产品场景，设计能力边界、人工兜底和评测方案" },
  { name: "AI 应用", goal: "能够实现一个带 RAG、工具调用和最小评测的 AI 应用" },
  { name: "确定课程", goal: "按 DeepLearning.AI 课程建立生成式 AI 产品判断" },
];

let passed = 0;
for (const item of cases) {
  const curriculum = await service.createCurriculum(`benchmark-${item.name}`, {
    goal: item.goal,
    weeklyCapacity: "light",
    materials: item.name === "确定课程" ? [{ url: "https://www.deeplearning.ai/courses/" }] : [],
  });
  const active = curriculum.assembly.decisions.filter((decision) =>
    ["anchor", "selected_units", "supplement"].includes(decision.role));
  const ok = active.length > 0
    && active.filter((decision) => decision.role === "anchor").length === 1
    && curriculum.assembly.stages[0]?.unitRefs.length > 0
    && curriculum.assembly.unresolvedGaps.length > 0;
  console.log(`${ok ? "PASS" : "FAIL"} ${item.name}: ${active.length} active sources`);
  if (ok) passed += 1;
}

const unknown = await service.analyzeMaterial("benchmark-material", {
  title: "Agent 产品设计实战",
  url: "https://example.com/agent-product-course",
  outline: "第一章 场景适配\n第二章 能力边界\n第三章 人工兜底\n第四章 评测与失败分析",
});
const materialOk = unknown.status === "candidate" && unknown.extractedUnits.length === 4;
console.log(`${materialOk ? "PASS" : "FAIL"} 陌生课程结构化解析`);
if (materialOk) passed += 1;

if (passed !== cases.length + 1) process.exit(1);
console.log(`PASS real model benchmark ${passed}/${cases.length + 1}`);
