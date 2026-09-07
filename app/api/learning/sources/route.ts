import { getCourseIntelligenceService, jsonError, ownerOf } from "../_shared";

export async function GET(request: Request) {
  try { return Response.json({ sources: await (await getCourseIntelligenceService()).listContentSources(await ownerOf(request)) }); }
  catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const service = await getCourseIntelligenceService();
    const source = await service.createContentSource(await ownerOf(request), await request.json().catch(() => ({})));
    return Response.json({ source }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
