import { getCourseIntelligenceService, jsonError, ownerOf } from "../../../_shared";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return Response.json(await (await getCourseIntelligenceService()).confirmUserContentFragments(await ownerOf(request), id, await request.json().catch(() => ({}))));
  } catch (error) { return jsonError(error); }
}
