import { getCourseIntelligenceService, jsonError, ownerOf } from "../../../_shared";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await (await getCourseIntelligenceService()).recordLearningSignal(await ownerOf(request), id, await request.json());
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
