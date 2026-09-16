import {
  getCourseIntelligenceService,
  jsonError,
  requireCourseIntelligenceAdmin,
} from "../../../../learning/_shared.ts";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCourseIntelligenceAdmin(request);
    const { id } = await context.params;
    const candidate = await (await getCourseIntelligenceService()).updateCourseCandidateDraft(id, await request.json());
    return Response.json({ candidate });
  } catch (error) {
    return jsonError(error);
  }
}
