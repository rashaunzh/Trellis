import { getLearningService, ownerOf, jsonError } from "../../../_shared";

// POST /api/learning/adjustments/:id/reject — 忽略路径调整建议
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await ownerOf(request);
    const { id } = await context.params;
    const workspace = await (await getLearningService()).rejectAdjustment(ownerId, id);
    return Response.json({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}
