import { getCourseIntelligenceService, jsonError, ownerOf } from "../../../_shared";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const curriculum = await (await getCourseIntelligenceService()).confirmCurriculum(ownerOf(request), id);
    return Response.json({ curriculum });
  } catch (error) {
    return jsonError(error);
  }
}
