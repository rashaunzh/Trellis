import { LearningApplicationService } from "../../../../lib/learning/application/learning-service.ts";
import { createRuleAgents } from "../../../../lib/learning/agents/index.ts";
import { evaluatePortfolioReadiness } from "../../../../lib/learning/agents/learning-quality.ts";
import { InMemoryLearningStore } from "../../../../lib/learning/persistence/in-memory.ts";
import { jsonError } from "../_shared";

// POST /api/learning/eval — 内置作品级评测（规则版，可无 API key 运行）
export async function POST() {
  try {
    const service = new LearningApplicationService(new InMemoryLearningStore(), createRuleAgents());
    const workspace = await service.runDiagnostic({
      ownerId: "portfolio-eval-owner",
      goal: "我是转 AI PM 的小白，希望 8 周内完成一个 AI Agent 产品 PRD 作品集项目",
      weeklyMinutes: 240,
      materialIds: ["res.gml-crash-course"],
      selfReport: {},
      preference: "breadth_first",
      plannerMode: "adaptive_existing_content",
    });
    const analysis = workspace.analysis!;
    const report = evaluatePortfolioReadiness({
      analysis,
      stagePath: analysis.stagePath,
      simulation: analysis.dynamicSimulation,
    });
    return Response.json({ report });
  } catch (error) {
    return jsonError(error);
  }
}
