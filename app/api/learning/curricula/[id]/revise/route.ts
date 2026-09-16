import { getCourseIntelligenceService, jsonError, ownerOf } from "../../../_shared";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const ownerId = await ownerOf(request);
    const result = await (await getCourseIntelligenceService()).reviseCurriculum(
      ownerId,
      id,
      await request.json(),
    );
    return Response.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
