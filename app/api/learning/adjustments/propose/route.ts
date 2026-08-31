import { getLearningService, ownerOf, jsonError, requireLegacyRuntime } from "../../_shared";
import type { AdjustmentType } from "../../../../../lib/learning/domain/types.ts";

// POST /api/learning/adjustments/propose — 用户主动提出调整诉求，系统保存为待确认提案
export async function POST(request: Request) {
  try {
    await requireLegacyRuntime(request);
    const ownerId = await ownerOf(request);
    const payload = (await request.json()) as Record<string, unknown>;
    const rawType = String(payload.adjustmentType ?? "weekly_light");
    const adjustmentType: AdjustmentType =
      rawType === "activity_replan" || rawType === "route_revision"
        ? rawType
        : "weekly_light";
    const reason = String(payload.reason ?? "");
    const workspace = await (await getLearningService()).proposeAdjustment(ownerId, {
      adjustmentType,
      reason,
    });
    return Response.json({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}
