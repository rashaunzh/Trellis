import { courseIntelligenceWorkflowSpec } from "../../../../lib/learning/intelligence/workflow-runtime.ts";

// GET /api/learning/mastra-runtime — Mastra runtime 注册状态
export async function GET() {
  return Response.json({
    runtime: {
      framework: "mastra",
      persistence: "cloudflare-d1",
      productionReady: true,
      spec: courseIntelligenceWorkflowSpec,
    },
  });
}

// POST /api/learning/mastra-runtime — 运行固定作品级 workflow demo
export async function POST() {
  return Response.json(
    { error: "固定作品工作流演示已退出正式调用链。请从 /api/learning/intake 启动课程智能工作流。" },
    { status: 410 },
  );
}
