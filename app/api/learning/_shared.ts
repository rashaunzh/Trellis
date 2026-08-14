// 共享：ownerId 解析 + 服务工厂（V0.2 单用户 MVP 用固定 owner）
import { LearningApplicationService } from "../../../lib/learning/application/learning-service.ts";
import { D1LearningStore } from "../../../lib/learning/persistence/d1.ts";
import { createRuleAgents } from "../../../lib/learning/agents/index.ts";

export const DEFAULT_OWNER = "trellis-owner";

// V0.2 学习内核使用 D1 持久化（Cloudflare Worker env.DB 绑定）。
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

export function ownerOf(_request: Request): string {
  return DEFAULT_OWNER;
}

export function jsonError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "未知错误";
  const status = error instanceof Error && "status" in error
    ? Number((error as { status?: number }).status) || 500
    : 500;
  return Response.json({ error: message }, { status });
}
