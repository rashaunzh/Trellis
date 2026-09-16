import { getCourseIntelligenceService, jsonError, ownerOf } from "../../_shared.ts";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await ownerOf(request);
    const { id } = await context.params;
    const workflow = await (await getCourseIntelligenceService()).getWorkflow(ownerId, id);
    if (!workflow) return Response.json({ error: "工作流不存在" }, { status: 404 });
    return Response.json({ workflow });
  } catch (error) {
    return jsonError(error);
  }
}
