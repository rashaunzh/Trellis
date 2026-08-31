import { getCourseIntelligenceContext, jsonError, ownerOf } from "../../_shared";
import { startCourseAnalysisWorkflow } from "../../../../../lib/learning/intelligence/workflow-runtime.ts";

export async function POST(request: Request) {
  try {
    const ownerId = await ownerOf(request);
    const { service, repository, db } = await getCourseIntelligenceContext();
    const workflow = await startCourseAnalysisWorkflow({
      ownerId, material: await request.json(), service, repository, db,
    });
    return Response.json({ workflow }, { status: workflow.status === "suspended" ? 202 : 200 });
  } catch (error) {
    return jsonError(error);
  }
}
