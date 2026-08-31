import { getLearningService, ownerOf, jsonError, requireLegacyRuntime } from "../../../_shared";

// POST /api/learning/nodes/:id/retest — 为已验证节点生成延迟复测活动
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireLegacyRuntime(request);
    const ownerId = await ownerOf(request);
    const workspace = await (await getLearningService()).retestNode(ownerId, params.id);
    return Response.json({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}
