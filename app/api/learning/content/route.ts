import { AI通识V1, 校验内容包 } from "../../../../lib/ai-literacy-v1";

export async function GET() {
  try {
    校验内容包();
    return Response.json({ contentPack:AI通识V1 });
  } catch (error) {
    return Response.json({ error:error instanceof Error ? error.message : "内容包校验失败" }, { status:500 });
  }
}
