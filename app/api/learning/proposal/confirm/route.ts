import { getLearningService, ownerOf, jsonError, requireLegacyRuntime } from "../../_shared";

// POST /api/learning/proposal/confirm — 用户轻确认路线和首周计划
export async function POST(request: Request) {
  try {
    await requireLegacyRuntime(request);
    const ownerId = await ownerOf(request);
    const workspace = await (await getLearningService()).confirmProposal(ownerId);
    return Response.json({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}
