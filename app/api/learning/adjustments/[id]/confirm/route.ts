import { getLearningService, ownerOf, jsonError } from "../../../_shared";

// POST /api/learning/adjustments/:id/confirm — 确认路径调整建议
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = ownerOf(request);
    const { id } = await context.params;
    const workspace = await (await getLearningService()).confirmAdjustment(ownerId, id);
    return Response.json({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}
