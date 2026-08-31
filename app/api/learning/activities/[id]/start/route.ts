import { getLearningService, ownerOf, jsonError, requireLegacyRuntime } from "../../../_shared";

// POST /api/learning/activities/:id/start — 开始某个学习活动
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLegacyRuntime(request);
    const ownerId = await ownerOf(request);
    const { id } = await context.params;
    const workspace = await (await getLearningService()).startActivity(ownerId, id);
    return Response.json({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}
