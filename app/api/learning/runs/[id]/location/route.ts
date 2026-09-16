import { getCourseIntelligenceService, jsonError, ownerOf } from "../../../_shared";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await (await getCourseIntelligenceService()).updateActivityLocation(
      await ownerOf(request), id, await request.json().catch(() => ({})),
    );
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
