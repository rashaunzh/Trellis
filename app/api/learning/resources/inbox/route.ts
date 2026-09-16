import { getLearningService, ownerOf, jsonError } from "../../_shared";

// GET /api/learning/resources/inbox — 当前 owner 的收集箱列表（随 workspace 返回，独立读接口）
// POST /api/learning/resources/inbox — 新增收集项（链接/笔记/工具/材料）
export async function GET(request: Request) {
  try {
    const ownerId = await ownerOf(request);
    const resources = await (await getLearningService()).listInboxResources(ownerId);
    return Response.json({ resources });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await ownerOf(request);
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      type?: "link" | "note" | "tool" | "resource";
      content?: string;
      sourceUrl?: string;
      relatedNodeIds?: string[];
    };
    await (await getLearningService()).saveUserResource(ownerId, {
      title: body.title ?? "",
      type: body.type ?? "link",
      content: body.content,
      sourceUrl: body.sourceUrl,
      relatedNodeIds: Array.isArray(body.relatedNodeIds) ? body.relatedNodeIds.map(String) : [],
    });
    const resources = await (await getLearningService()).listInboxResources(ownerId);
    return Response.json({ resources });
  } catch (error) {
    return jsonError(error);
  }
}
