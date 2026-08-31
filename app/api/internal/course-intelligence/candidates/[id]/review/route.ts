import { z } from "zod";

import {
  getCourseIntelligenceContext,
  jsonError,
  requireCourseIntelligenceAdmin,
} from "../../../../../learning/_shared.ts";
import { resumeCourseAnalysisWorkflow } from "../../../../../../../lib/learning/intelligence/workflow-runtime.ts";

const reviewSchema = z.object({
  decision: z.enum(["validated", "rejected"]),
  reason: z.string().trim().min(3).max(1200),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const reviewerOwnerId = await requireCourseIntelligenceAdmin(request);
    const { id } = await context.params;
    const body = reviewSchema.parse(await request.json());
    const { service, repository, db } = await getCourseIntelligenceContext();
    const candidate = await repository.getCourseCandidate(id);
    if (!candidate) return Response.json({ error: "课程候选不存在" }, { status: 404 });
    if (candidate.workflowRunId) {
      const workflow = await resumeCourseAnalysisWorkflow({
        ownerId: candidate.ownerId, candidateId: id, approved: body.decision === "validated",
        reviewerOwnerId, reason: body.reason, service, repository, db,
      });
      return Response.json({ candidate: await repository.getCourseCandidate(id), workflow });
    }
    const reviewed = await service.reviewCourseCandidate({ candidateId: id, reviewerOwnerId, ...body });
    return Response.json({ candidate: reviewed });
  } catch (error) {
    return jsonError(error);
  }
}
