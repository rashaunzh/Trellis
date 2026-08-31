import { getLearningService, ownerOf, jsonError } from "../_shared";

// GET /api/learning/artifact — 读取当前作品迭代状态与版本历史
export async function GET(request: Request) {
  try {
    const ownerId = ownerOf(request);
    const workspace = await (await getLearningService()).getWorkspace(ownerId);
    return Response.json({ artifactIteration: workspace.artifactIteration });
  } catch (error) {
    return jsonError(error);
  }
}

// POST /api/learning/artifact — 生成作品任务，正式进入活动/证据/掌握确认闭环
export async function POST(request: Request) {
  try {
    const ownerId = ownerOf(request);
    const workspace = await (await getLearningService()).createPortfolioArtifactActivity(ownerId);
    return Response.json({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}
