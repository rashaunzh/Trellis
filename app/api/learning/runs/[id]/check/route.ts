import { getCourseIntelligenceService, jsonError, ownerOf } from "../../../_shared";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (new URL(request.url).searchParams.get("view") === "lesson") {
      return Response.json(await (await getCourseIntelligenceService()).getActivityLesson(await ownerOf(request), id));
    }
    const check = await (await getCourseIntelligenceService()).getScenarioCheck(await ownerOf(request), id);
    return Response.json({ check });
  } catch (error) {
    return jsonError(error);
  }
}
