// 共享：ownerId 解析 + 服务工厂（V0.2 单用户 MVP 用固定 owner）
import { LearningApplicationService } from "../../../lib/learning/application/learning-service.ts";
import { InMemoryLearningStore } from "../../../lib/learning/persistence/in-memory.ts";
import { createRuleAgents } from "../../../lib/learning/agents/index.ts";

export const DEFAULT_OWNER = "trellis-owner";

// 单用户 MVP：进程内内存仓储。
// Phase 5 前切换 D1LearningStore（见 lib/learning/persistence/d1.ts）。
let service: LearningApplicationService | null = null;

export function getLearningService(): LearningApplicationService {
  if (!service) {
    service = new LearningApplicationService(
      new InMemoryLearningStore(),
      createRuleAgents(),
    );
  }
  return service;
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
