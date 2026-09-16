import { getCourseIntelligenceService, jsonError, ownerOf } from "../../../_shared";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await (await getCourseIntelligenceService()).getLearningTaskResult(await ownerOf(request), id);
    return Response.json({ result });
  } catch (error) {
    return jsonError(error);
  }
}
