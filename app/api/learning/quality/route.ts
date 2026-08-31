import { getLearningService, ownerOf, jsonError } from "../_shared";

// GET /api/learning/quality — 学习链路质量监控读模型
export async function GET(request: Request) {
  try {
    const ownerId = ownerOf(request);
    const quality = await (await getLearningService()).getLearningQuality(ownerId);
    return Response.json({ quality });
  } catch (error) {
    return jsonError(error);
  }
}
