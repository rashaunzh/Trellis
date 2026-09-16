import { getCourseIntelligenceService, jsonError, ownerOf } from "../../../_shared.ts";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await ownerOf(request);
    const { id } = await context.params;
    const decision = await (await getCourseIntelligenceService()).rejectDecision(ownerId, id);
    return Response.json({ decision });
  } catch (error) {
    return jsonError(error);
  }
}
