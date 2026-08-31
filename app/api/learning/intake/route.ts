import { getCourseIntelligenceContext, jsonError, ownerOf } from "../_shared";
import { startCourseIntelligenceWorkflow } from "../../../../lib/learning/intelligence/workflow-runtime.ts";

export async function POST(request: Request) {
  try {
    const ownerId = await ownerOf(request);
    const { service, repository, db } = await getCourseIntelligenceContext();
    const result = await startCourseIntelligenceWorkflow({
      ownerId,
      rawIntake: await request.json(),
      service,
      repository,
      db,
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
