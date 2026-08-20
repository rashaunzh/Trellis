// 共享：ownerId 解析 + 服务工厂（V0.2 单用户 MVP 用固定 owner）
import { LearningApplicationService } from "../../../lib/learning/application/learning-service.ts";
import { D1LearningStore } from "../../../lib/learning/persistence/d1.ts";
import { createRuleAgents } from "../../../lib/learning/agents/index.ts";

// V0.2 demo 匿名 owner 隔离：请求头 `x-trellis-owner-id` 优先，无/非法回退固定 owner。
// 这是匿名隔离（每个浏览器一个状态），不是鉴权；不引入登录、不改数据模型。
export const DEFAULT_OWNER = "trellis-owner";

const OWNER_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function ownerOf(request: Request): string {
  const header = request.headers.get("x-trellis-owner-id");
  return header && OWNER_ID_PATTERN.test(header) ? header : DEFAULT_OWNER;
}
// 直接取 env.DB 原生实例（D1 store 用 prepare/bind/run，不经过 drizzle 包装）。
// 每次请求创建 store——D1 store 无状态（查询走数据库），进程重启后状态依然可恢复。
export async function getLearningService(): Promise<LearningApplicationService> {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  }
  // env.DB 类型依赖未安装的 D1 类型声明，D1 store 用 any 桥接（仓库 pre-existing 约定）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store = new D1LearningStore(env.DB as any);
  // 幂等种子：内容层表（routes/nodes/edges/...）首次使用时写入，
  // 保证状态层外键有真实引用。INSERT OR IGNORE，重复调用无副作用。
  await store.seedContent();
  return new LearningApplicationService(store, createRuleAgents());
}

export function jsonError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "未知错误";
  const status = error instanceof Error && "status" in error
    ? Number((error as { status?: number }).status) || 500
    : 500;
  return Response.json({ error: message }, { status });
}
