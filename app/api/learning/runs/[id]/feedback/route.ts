import { getCourseIntelligenceContext, jsonError, ownerOf } from "../../../_shared";
import { startLearningAdaptationWorkflow } from "../../../../../../lib/learning/intelligence/workflow-runtime.ts";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const ownerId = await ownerOf(request);
    const { service, repository, db } = await getCourseIntelligenceContext();
    const result = await startLearningAdaptationWorkflow({
      ownerId, activityId: id, signal: await request.json(), service, repository, db,
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
