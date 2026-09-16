import { getCourseIntelligenceService, jsonError, ownerOf } from "../../_shared";

export async function GET(request: Request) {
  try {
    const state = await (await getCourseIntelligenceService()).getState(await ownerOf(request));
    return Response.json({ state });
  } catch (error) {
    return jsonError(error);
  }
}
