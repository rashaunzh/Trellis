import { z } from "zod";
import { buildLearningOrchestrationState } from "../../../../../lib/learning/intelligence/orchestration.ts";
import { getCourseIntelligenceService, getLearningService, jsonError, ownerOf } from "../../_shared";

const assessmentSchema = z.object({
  activityId: z.string().trim().min(1),
  type: z.enum(["understanding", "quiz_result", "stuck", "judgment", "scenario_choice"]).default("understanding"),
  value: z.union([z.string().trim().min(1).max(1200), z.number().min(0).max(100), z.boolean()]),
  note: z.string().trim().max(1200).default(""),
  questionId: z.string().trim().max(160).optional(),
  actualMinutes: z.number().int().min(1).max(720).optional(),
  completionIntent: z.enum(["auto", "complete", "keep_open"]).optional(),
});

export async function POST(request: Request) {
  try {
    const ownerId = await ownerOf(request);
    const input = assessmentSchema.parse(await request.json().catch(() => ({})));
    const courseService = await getCourseIntelligenceService();
    const learningService = await getLearningService();
    const result = await courseService.recordLearningSignal(ownerId, input.activityId, {
      type: input.type,
      value: input.value,
      note: input.note,
      questionId: input.questionId,
      actualMinutes: input.actualMinutes,
      completionIntent: input.completionIntent,
    });
    const [state, current, resources] = await Promise.all([
      courseService.getState(ownerId),
      courseService.getCurrentLearning(ownerId),
      learningService.listInboxResources(ownerId),
    ]);
    return Response.json({ result, orchestration: buildLearningOrchestrationState({ state, current, resources }) });
  } catch (error) {
    return jsonError(error);
  }
}
