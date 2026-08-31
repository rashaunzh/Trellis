import { getCourseIntelligenceService, jsonError, ownerOf } from "../_shared";

export async function POST(request: Request) {
  try {
    const curriculum = await (await getCourseIntelligenceService()).createCurriculum(ownerOf(request), await request.json());
    return Response.json({ curriculum }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
