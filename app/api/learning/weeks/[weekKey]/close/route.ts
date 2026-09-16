import { getCourseIntelligenceService, jsonError, ownerOf } from "../../../_shared";

export async function POST(request: Request, context: { params: Promise<{ weekKey: string }> }) {
  try {
    const { weekKey } = await context.params;
    const result = await (await getCourseIntelligenceService()).closeWeek(await ownerOf(request), weekKey);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
