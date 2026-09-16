import { getCourseIntelligenceService, jsonError, ownerOf } from "../_shared";

export async function GET(request: Request) {
  try {
    const current = await (await getCourseIntelligenceService()).getCurrentLearning(await ownerOf(request));
    return Response.json({ current });
  } catch (error) {
    return jsonError(error);
  }
}
