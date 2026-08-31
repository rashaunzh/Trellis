import { getCourseIntelligenceService, jsonError, ownerOf } from "../../_shared";

export async function POST(request: Request) {
  try {
    const analysis = await (await getCourseIntelligenceService()).analyzeMaterial(await ownerOf(request), await request.json());
    return Response.json({ analysis });
  } catch (error) {
    return jsonError(error);
  }
}
