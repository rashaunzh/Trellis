import {
  getCourseIntelligenceContext,
  jsonError,
  requireCourseIntelligenceAdmin,
} from "../../../../../learning/_shared.ts";
import { startSourceEvolutionWorkflow } from "../../../../../../../lib/learning/intelligence/workflow-runtime.ts";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCourseIntelligenceAdmin(request);
    const { id } = await context.params;
    const { service, repository, db } = await getCourseIntelligenceContext();
    const workflow = await startSourceEvolutionWorkflow({ sourceId: id, service, repository, db });
    return Response.json({ workflow }, { status: workflow.status === "suspended" ? 202 : 200 });
  } catch (error) {
    return jsonError(error);
  }
}
