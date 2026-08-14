import { getLearningService, ownerOf, jsonError } from "../_shared";

// GET /api/learning/workspace — 一次恢复学习/成长/工作台所需状态
export async function GET(request: Request) {
  try {
    const ownerId = ownerOf(request);
    const workspace = await getLearningService().getWorkspace(ownerId);
    return Response.json({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}
