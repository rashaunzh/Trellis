import { getLearningService, ownerOf, jsonError, requireLegacyRuntime } from "../_shared";

// GET /api/learning/week-review — 当前周复盘读模型
export async function GET(request: Request) {
  try {
    const ownerId = await ownerOf(request);
    const weekKey = new URL(request.url).searchParams.get("weekKey") ?? undefined;
    const workspace = await (await getLearningService()).getWorkspace(ownerId, { weekKey });
    return Response.json({ weekReview: workspace.weekReview });
  } catch (error) {
    return jsonError(error);
  }
}

// POST /api/learning/week-review — 基于本周复盘生成下一周计划
export async function POST(request: Request) {
  try {
    await requireLegacyRuntime(request);
    const ownerId = await ownerOf(request);
    const body = (await request.json().catch(() => ({}))) as { weekKey?: string; generateNextWeek?: boolean };
    const service = await getLearningService();
    const workspace = body.generateNextWeek === false
      ? await service.archiveCurrentWeekReview(ownerId, body.weekKey)
      : await service.generateNextWeekPlan(ownerId, body.weekKey);
    return Response.json({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}
