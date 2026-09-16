import { buildLearningOrchestrationState } from "../../../../../lib/learning/intelligence/orchestration.ts";
import { getCourseIntelligenceService, getLearningService, jsonError, ownerOf } from "../../_shared";

export async function POST(request: Request) {
  try {
    const ownerId = await ownerOf(request);
    const body = (await request.json().catch(() => ({}))) as { weekKey?: string };
    const courseService = await getCourseIntelligenceService();
    const learningService = await getLearningService();
    const before = await courseService.getCurrentLearning(ownerId);
    if (before.weeklyPlan) {
      await courseService.closeWeek(ownerId, body.weekKey ?? before.weeklyPlan.weekKey);
    }
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
