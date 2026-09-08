import { z } from "zod";
import { getCourseIntelligenceService, jsonError, ownerOf } from "../../../_shared";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { analysisVersion } = z.object({ analysisVersion: z.number().int().positive() }).parse(await request.json());
    return Response.json(await (await getCourseIntelligenceService()).adoptUserContentSource(await ownerOf(request), id, analysisVersion));
  } catch (error) { return jsonError(error); }
}
