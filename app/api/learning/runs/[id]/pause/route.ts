import { getCourseIntelligenceService, jsonError, ownerOf } from "../../../_shared";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const activity = await (await getCourseIntelligenceService()).pauseActivity(
      await ownerOf(request), id, await request.json().catch(() => ({})),
    );
    return Response.json({ activity });
  } catch (error) {
    return jsonError(error);
  }
}
