import {
  runTrellisMastraWorkflowDemo,
  trellisMastraWorkflowSpec,
  trellisMastraRuntime,
} from "../../../../lib/learning/agents/mastra-workflow.ts";
import { jsonError } from "../_shared";

// GET /api/learning/mastra-runtime — Mastra runtime 注册状态
export async function GET() {
  try {
    const workflow = trellisMastraRuntime.getWorkflow("trellisLearningSituationWorkflow");
    return Response.json({
      runtime: {
        provider: "mastra",
        package: "@mastra/core",
        cliScriptConfigured: true,
        workflowId: workflow.id,
        registered: true,
        stepCount: trellisMastraWorkflowSpec.steps.length,
        hitlCount: trellisMastraWorkflowSpec.steps.filter((step) => step.humanInTheLoop).length,
        studioScriptConfigured: true,
        studioNote: "可通过 npm run mastra:dev / npm run mastra:studio 启动；作品集自动验收以 API、demo:mastra 和 browser acceptance 为准。",
      },
      spec: trellisMastraWorkflowSpec,
    });
  } catch (error) {
    return jsonError(error);
  }
}

// POST /api/learning/mastra-runtime — 运行固定作品级 workflow demo
export async function POST() {
  try {
    const report = await runTrellisMastraWorkflowDemo();
    return Response.json({ report });
  } catch (error) {
    return jsonError(error);
  }
}
