import { getCourseIntelligenceContext, jsonError, requireCourseIntelligenceAdmin } from "../../../learning/_shared.ts";
import type { AnalysisRunRecord } from "../../../../../lib/learning/intelligence/repository.ts";

export async function GET(request: Request) {
  try {
    await requireCourseIntelligenceAdmin(request);
    const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit") ?? 100), 1), 200);
    const { repository } = await getCourseIntelligenceContext();
    const attempts = await repository.listAnalysisRuns({ limit });
    return Response.json({ attempts: attempts.map(publicAttempt) });
  } catch (error) {
    return jsonError(error);
  }
}

function publicAttempt(run: AnalysisRunRecord) {
  return {
    id: run.id, requestId: run.requestId ?? run.id, workflowRunId: run.workflowRunId ?? null,
    decisionId: run.decisionId ?? null, taskKind: run.kind, contractVersion: run.contractVersion ?? "legacy",
    slot: run.slot ?? "primary", attempt: run.attempt ?? 1, provider: run.provider, model: run.model,
    status: run.status, failureClass: run.failureClass ?? "", fallbackReason: run.fallbackReason ?? "",
    cacheHit: run.cacheHit ?? false, latencyMs: run.latencyMs, promptTokens: run.promptTokens,
    completionTokens: run.completionTokens, evalJson: run.evalJson ?? "{}", createdAt: run.createdAt,
  };
}
