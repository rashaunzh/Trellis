import { getLearningService, ownerOf, jsonError } from "../_shared";

// POST /api/learning/reset — 重新设置：清空该用户学习状态，回到未诊断起点
export async function POST(request: Request) {
  try {
    const ownerId = await ownerOf(request);
    const workspace = await (await getLearningService()).resetLearner(ownerId);
    return Response.json({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}
