import { getLearningService, ownerOf, jsonError } from "../../../_shared";

// POST /api/learning/nodes/:id/confirm-mastery — 掌握确认（confirmed 验证 / corrected 纠正降级）
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const ownerId = await ownerOf(request);
    const body = (await request.json().catch(() => ({}))) as {
      decision?: "confirmed" | "corrected";
      note?: string;
    };
    const workspace = await (await getLearningService()).confirmMastery(ownerId, params.id, {
      decision: body.decision === "corrected" ? "corrected" : "confirmed",
      note: body.note,
    });
    return Response.json({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}
