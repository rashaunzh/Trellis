import { buildLearningOrchestrationState } from "../../../../lib/learning/intelligence/orchestration.ts";
import { getCourseIntelligenceService, getLearningService, jsonError, ownerOf } from "../_shared";

export async function GET(request: Request) {
  try {
    const ownerId = await ownerOf(request);
    const [courseService, learningService] = await Promise.all([
      getCourseIntelligenceService(),
      getLearningService(),
    ]);
    const [state, current, resources] = await Promise.all([
      courseService.getState(ownerId),
      courseService.getCurrentLearning(ownerId),
      learningService.listInboxResources(ownerId),
    ]);
    return Response.json({ orchestration: buildLearningOrchestrationState({ state, current, resources }) });
  } catch (error) {
    return jsonError(error);
  }
}
