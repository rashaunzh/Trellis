import {
  getCourseIntelligenceService,
  jsonError,
  requireCourseIntelligenceAdmin,
} from "../../../../../learning/_shared.ts";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const reviewerOwnerId = await requireCourseIntelligenceAdmin(request);
    const { id } = await context.params;
    const course = await (await getCourseIntelligenceService())
      .publishCourseCandidate(id, await request.json(), reviewerOwnerId);
    return Response.json({ course }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
