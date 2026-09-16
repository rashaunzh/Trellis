import { getCourseIntelligenceService, ownerOf, jsonError } from "../_shared";

// POST /api/learning/reset — 清空该用户正式学习状态，保留共享课程目录。
export async function POST(request: Request) {
  try {
    const ownerId = await ownerOf(request);
    const current = await (await getCourseIntelligenceService()).resetCurrentLearning(ownerId);
    return Response.json({ current });
  } catch (error) {
    return jsonError(error);
  }
}
