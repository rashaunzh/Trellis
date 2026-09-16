import { z } from "zod";
import { buildLearningOrchestrationState } from "../../../../../lib/learning/intelligence/orchestration.ts";
import { getCourseIntelligenceService, getLearningService, jsonError, ownerOf } from "../../_shared";

const diagnoseSchema = z.object({
  goal: z.string().trim().min(1).max(1200),
  weeklyMinutes: z.number().int().min(30).max(1200).default(240),
  materials: z.array(z.object({
    title: z.string().trim().max(200).default(""),
    url: z.string().trim().max(2000).default(""),
    outline: z.string().trim().max(30000).default(""),
  })).max(8).default([]),
});

export async function POST(request: Request) {
  try {
    const ownerId = await ownerOf(request);
    const input = diagnoseSchema.parse(await request.json().catch(() => ({})));
    const courseService = await getCourseIntelligenceService();
    const learningService = await getLearningService();
    const curriculum = await courseService.createCurriculum(ownerId, {
      goal: input.goal,
      weeklyCapacity: capacityFromMinutes(input.weeklyMinutes),
      materials: input.materials,
    });
    const [state, current, resources] = await Promise.all([
      courseService.getState(ownerId),
      courseService.getCurrentLearning(ownerId),
      learningService.listInboxResources(ownerId),
    ]);
    return Response.json({ curriculum, orchestration: buildLearningOrchestrationState({ state, current, resources }) });
  } catch (error) {
    return jsonError(error);
  }
}

function capacityFromMinutes(minutes: number) {
  if (minutes <= 150) return "light";
  if (minutes <= 300) return "steady";
  if (minutes <= 420) return "focused";
  return "intensive";
}
