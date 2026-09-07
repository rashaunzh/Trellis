import { getCourseIntelligenceService, jsonError, ownerOf } from "../../../_shared";

export async function POST(request: Request, context: { params: Promise<{ weekKey: string }> }) {
  try {
    const { weekKey } = await context.params;
    const plan = await (await getCourseIntelligenceService()).confirmWeek(await ownerOf(request), weekKey);
    return Response.json({ plan });
  } catch (error) {
    return jsonError(error);
  }
}
