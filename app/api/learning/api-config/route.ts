import { getLearningService, ownerOf, jsonError } from "../_shared";

// GET /api/learning/api-config — 读取配置状态（key 脱敏）
export async function GET(request: Request) {
  try {
    const ownerId = ownerOf(request);
    const status = await (await getLearningService()).getApiConfigStatus(ownerId);
    return Response.json({ config: status });
  } catch (error) {
    return jsonError(error);
  }
}

// POST /api/learning/api-config — 保存用户自配的 LLM API
// body: { baseUrl, apiKey?, model, enabled }
export async function POST(request: Request) {
  try {
    const ownerId = ownerOf(request);
    const body = (await request.json()) as {
      baseUrl?: string;
      apiKey?: string;
      model?: string;
      enabled?: boolean;
    };
    const status = await (await getLearningService()).saveApiConfig(ownerId, {
      baseUrl: body.baseUrl ?? "",
      apiKey: body.apiKey ?? "",
      model: body.model ?? "",
      enabled: Boolean(body.enabled),
    });
    return Response.json({ config: status });
  } catch (error) {
    return jsonError(error);
  }
}
