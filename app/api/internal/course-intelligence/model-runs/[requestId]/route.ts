import { getCourseIntelligenceContext, jsonError, requireCourseIntelligenceAdmin } from "../../../../learning/_shared.ts";

export async function GET(request: Request, context: { params: Promise<{ requestId: string }> }) {
  try {
    await requireCourseIntelligenceAdmin(request);
    const { requestId } = await context.params;
    const { repository } = await getCourseIntelligenceContext();
    const attempts = await repository.listAnalysisRuns({ requestId, limit: 20 });
    if (attempts.length === 0) throw Object.assign(new Error("模型运行记录不存在"), { status: 404 });
    return Response.json({
      requestId,
      workflowRunId: attempts.find((item) => item.workflowRunId)?.workflowRunId ?? null,
      decisionId: attempts.find((item) => item.decisionId)?.decisionId ?? null,
      attempts: attempts.map((run) => ({
        id: run.id, taskKind: run.kind, contractVersion: run.contractVersion ?? "legacy", slot: run.slot ?? "primary",
        attempt: run.attempt ?? 1, provider: run.provider, model: run.model, status: run.status,
        failureClass: run.failureClass ?? "", fallbackReason: run.fallbackReason ?? "", cacheHit: run.cacheHit ?? false,
        latencyMs: run.latencyMs, promptTokens: run.promptTokens, completionTokens: run.completionTokens,
        evalJson: run.evalJson ?? "{}", createdAt: run.createdAt,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
