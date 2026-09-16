import { getLearningService, ownerOf, jsonError, requireLegacyRuntime } from "../../../_shared";

// POST /api/learning/evidence/:id/review — 规则/AI 评估证据，用户可确认
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLegacyRuntime(request);
    const ownerId = await ownerOf(request);
    const { id } = await context.params;
    const result = await (await getLearningService()).reviewEvidence(ownerId, id);
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
