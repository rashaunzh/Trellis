import { z } from "zod";
import { buildLearningOrchestrationState } from "../../../../../lib/learning/intelligence/orchestration.ts";
import { getCourseIntelligenceService, getLearningService, jsonError, ownerOf, requireLegacyRuntime } from "../../_shared";

const artifactReviewSchema = z.object({
  activityId: z.string().trim().min(1),
  content: z.string().trim().min(1).max(10000),
  externalUrl: z.string().trim().max(2000).default(""),
  evidenceType: z.enum(["explanation", "artifact", "code", "judgment", "notes", "external"]).default("artifact"),
});

export async function POST(request: Request) {
  try {
    await requireLegacyRuntime(request);
    const ownerId = await ownerOf(request);
    const input = artifactReviewSchema.parse(await request.json().catch(() => ({})));
    const courseService = await getCourseIntelligenceService();
    const learningService = await getLearningService();
    const workspace = await learningService.submitEvidence(ownerId, input.activityId, {
      content: input.content,
      externalUrl: input.externalUrl,
      evidenceType: input.evidenceType,
    });
    const evidence = workspace.evidence.find((item) => item.activityId === input.activityId);
    const assessment = evidence ? await learningService.reviewEvidence(ownerId, evidence.id) : null;
    const [state, current, resources] = await Promise.all([
      courseService.getState(ownerId),
      courseService.getCurrentLearning(ownerId),
      learningService.listInboxResources(ownerId),
    ]);
    return Response.json({ assessment, orchestration: buildLearningOrchestrationState({ state, current, resources }) });
  } catch (error) {
    return jsonError(error);
  }
}
