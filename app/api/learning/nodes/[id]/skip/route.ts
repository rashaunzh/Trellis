import { getLearningService, ownerOf, jsonError } from "../../../_shared";

// POST /api/learning/nodes/:id/skip — 跳学：生成验证活动，节点进入待验证
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await ownerOf(request);
    const { id } = await context.params;
    const workspace = await (await getLearningService()).skipNode(ownerId, id);
    return Response.json({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}
