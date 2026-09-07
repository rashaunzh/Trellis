import { getCourseIntelligenceService, jsonError, ownerOf } from "../../../_shared";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await (await getCourseIntelligenceService()).attachResource(
      await ownerOf(request), id, await request.json().catch(() => ({})),
    );
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await (await getCourseIntelligenceService()).detachResource(
      await ownerOf(request), id, await request.json().catch(() => ({})),
    );
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
