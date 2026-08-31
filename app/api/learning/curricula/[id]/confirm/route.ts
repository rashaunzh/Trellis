import { getCourseIntelligenceContext, jsonError, ownerOf } from "../../../_shared";
import { resumeCourseIntelligenceWorkflow } from "../../../../../../lib/learning/intelligence/workflow-runtime.ts";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const ownerId = await ownerOf(request);
    const { service, repository, db } = await getCourseIntelligenceContext();
    const result = await resumeCourseIntelligenceWorkflow({
      ownerId,
      curriculumId: id,
      approved: true,
      service,
      repository,
      db,
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
