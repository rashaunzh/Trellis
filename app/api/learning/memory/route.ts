import { getLearningService, ownerOf, jsonError } from "../_shared";

// GET /api/learning/memory — Learning Memory 聚合读模型（不新增 schema）
export async function GET(request: Request) {
  try {
    const ownerId = await ownerOf(request);
    const memory = await (await getLearningService()).getLearningMemory(ownerId);
    return Response.json({ memory });
  } catch (error) {
    return jsonError(error);
  }
}
