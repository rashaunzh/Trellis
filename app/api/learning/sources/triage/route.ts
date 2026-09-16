import { z } from "zod";
import { buildLearningOrchestrationState } from "../../../../../lib/learning/intelligence/orchestration.ts";
import { getCourseIntelligenceService, getLearningService, jsonError, ownerOf } from "../../_shared";

const sourceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: z.enum(["link", "note", "tool", "resource"]).default("link"),
  content: z.string().trim().max(5000).default(""),
  sourceUrl: z.string().trim().max(2000).default(""),
  relatedNodeIds: z.array(z.string().trim().min(1)).max(12).default([]),
});

export async function POST(request: Request) {
  try {
    const ownerId = await ownerOf(request);
    const input = sourceSchema.parse(await request.json().catch(() => ({})));
    const courseService = await getCourseIntelligenceService();
    const learningService = await getLearningService();
    await learningService.saveUserResource(ownerId, input);
    const [state, current, resources] = await Promise.all([
      courseService.getState(ownerId),
      courseService.getCurrentLearning(ownerId),
      learningService.listInboxResources(ownerId),
    ]);
    const orchestration = buildLearningOrchestrationState({ state, current, resources });
    return Response.json({ sourceCenter: orchestration.controlCenter.sourceCenter, orchestration });
  } catch (error) {
    return jsonError(error);
  }
}
