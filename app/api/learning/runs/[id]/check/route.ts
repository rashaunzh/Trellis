import { getCourseIntelligenceService, jsonError, ownerOf } from "../../../_shared";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const check = await (await getCourseIntelligenceService()).getScenarioCheck(await ownerOf(request), id);
    return Response.json({ check });
  } catch (error) {
    return jsonError(error);
  }
}
