import {
  getCourseIntelligenceService,
  jsonError,
  requireCourseIntelligenceAdmin,
} from "../../../../../learning/_shared.ts";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCourseIntelligenceAdmin(request);
    const { id } = await context.params;
    const job = await (await getCourseIntelligenceService()).refreshSource(id);
    return Response.json({ job }, { status: job.status === "candidate" ? 201 : 200 });
  } catch (error) {
    return jsonError(error);
  }
}
