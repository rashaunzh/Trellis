import { getCourseIntelligenceService, jsonError, ownerOf } from "../../_shared";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const curriculum = await (await getCourseIntelligenceService()).getCurriculum(ownerOf(request), id);
    if (!curriculum) return Response.json({ error: "课程方案不存在" }, { status: 404 });
    return Response.json({ curriculum });
  } catch (error) {
    return jsonError(error);
  }
}
