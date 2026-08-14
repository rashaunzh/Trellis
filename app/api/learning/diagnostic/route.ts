import { getLearningService, ownerOf, jsonError } from "../_shared";

// POST /api/learning/diagnostic — 目标 + 每周时间 + 材料 + 自评 → 初始画像 + 推荐路线
export async function POST(request: Request) {
  try {
    const ownerId = ownerOf(request);
    const payload = (await request.json()) as Record<string, unknown>;
    if (!String(payload.goal ?? "").trim()) {
      return Response.json({ error: "学习目标不能为空" }, { status: 400 });
    }
    const weeklyMinutes = Math.min(
      720,
      Math.max(30, Math.round((Number(payload.weeklyMinutes) || 180) / 15) * 15),
    );
    const workspace = await (await getLearningService()).runDiagnostic({
      ownerId,
      goal: String(payload.goal).trim().slice(0, 1000),
      weeklyMinutes,
      materialIds: Array.isArray(payload.materialIds)
        ? payload.materialIds.map(String).slice(0, 20)
        : [],
      selfReport:
        payload.selfReport && typeof payload.selfReport === "object"
          ? (payload.selfReport as Record<string, number>)
          : undefined,
      preference: payload.preference === "build_first" ? "build_first" : "breadth_first",
    });
    return Response.json({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}
