import { getLearningService, ownerOf, jsonError } from "../_shared";

// POST /api/learning/replan — 温和重排本周：保留证据/节点进度，只替换未产生证据的开放活动
export async function POST(request: Request) {
  try {
    const ownerId = await ownerOf(request);
    const body = (await request.json().catch(() => ({}))) as { weeklyMinutes?: number };
    const workspace = await (await getLearningService()).replanCurrentWeek(ownerId, {
      weeklyMinutes: body.weeklyMinutes,
    });
    return Response.json({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}
