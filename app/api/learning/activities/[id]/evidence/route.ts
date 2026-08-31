import { getLearningService, ownerOf, jsonError, requireLegacyRuntime } from "../../../_shared";

// POST /api/learning/activities/:id/evidence — 提交证据
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLegacyRuntime(request);
    const ownerId = await ownerOf(request);
    const { id } = await context.params;
    const payload = (await request.json()) as Record<string, unknown>;
    const workspace = await (await getLearningService()).submitEvidence(ownerId, id, {
      content: String(payload.content ?? ""),
      externalUrl: payload.externalUrl ? String(payload.externalUrl) : undefined,
      evidenceType: (payload.evidenceType as never) ?? undefined,
    });
    return Response.json({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}
