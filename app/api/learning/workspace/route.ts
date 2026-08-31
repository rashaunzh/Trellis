import { getLearningService, ownerOf, jsonError } from "../_shared";

// GET /api/learning/workspace — 一次恢复学习/成长/工作台所需状态
export async function GET(request: Request) {
  try {
    const ownerId = await ownerOf(request);
    const weekKey = new URL(request.url).searchParams.get("weekKey") ?? undefined;
    const workspace = await (await getLearningService()).getWorkspace(ownerId, { weekKey });
    return Response.json({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}
