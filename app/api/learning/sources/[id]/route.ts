import { getCourseIntelligenceService, jsonError, ownerOf } from "../../_shared";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return Response.json({ ...(await (await getCourseIntelligenceService()).getContentSourceDetails(await ownerOf(request), id)) });
  } catch (error) { return jsonError(error); }
}
