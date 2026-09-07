import { getCourseIntelligenceService, jsonError, ownerOf } from "../../../_shared";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return Response.json(await (await getCourseIntelligenceService()).analyzeUserContentSource(await ownerOf(request), id));
  } catch (error) { return jsonError(error); }
}
