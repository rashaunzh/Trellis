// 共享：ownerId 解析 + 服务工厂（V0.2 单用户 MVP 用固定 owner）
import { LearningApplicationService } from "../../../lib/learning/application/learning-service.ts";
import { D1LearningStore } from "../../../lib/learning/persistence/d1.ts";
import { createRuleAgents } from "../../../lib/learning/agents/index.ts";
import { D1CourseIntelligenceRepository } from "../../../lib/learning/intelligence/repository.ts";
import { CourseIntelligenceModelGateway, builtInModelConfig } from "../../../lib/learning/intelligence/model-gateway.ts";
import { CourseIntelligenceService } from "../../../lib/learning/intelligence/service.ts";
import { z } from "zod";

// V0.2 demo 匿名 owner 隔离：请求头 `x-trellis-owner-id` 优先，无/非法回退固定 owner。
// 这是匿名隔离（每个浏览器一个状态），不是鉴权；不引入登录、不改数据模型。
export const DEFAULT_OWNER = "trellis-owner";

const OWNER_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const AUTHENTICATED_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let legacyContentReady: Promise<void> | null = null;
let courseCatalogReady: Promise<void> | null = null;

function initializeOnce(current: Promise<void> | null, work: () => Promise<void>, reset: () => void): Promise<void> {
  if (current) return current;
  const pending = work().catch((error) => {
    reset();
    throw error;
  });
  return pending;
}

export function ownerOf(request: Request): string {
  const authenticatedEmail = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (authenticatedEmail && authenticatedEmail.length <= 320 && AUTHENTICATED_EMAIL_PATTERN.test(authenticatedEmail)) {
    return `chatgpt-${stableOwnerHash(authenticatedEmail)}`;
  }
  const header = request.headers.get("x-trellis-owner-id");
  return header && OWNER_ID_PATTERN.test(header) ? header : DEFAULT_OWNER;
}

function stableOwnerHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
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
  legacyContentReady = initializeOnce(legacyContentReady, () => store.seedContent(), () => {
    legacyContentReady = null;
  });
  await legacyContentReady;
  return new LearningApplicationService(store, createRuleAgents());
}

export async function getCourseIntelligenceService(): Promise<CourseIntelligenceService> {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = env.DB as any;
  const repository = new D1CourseIntelligenceRepository(db);
  const learningStore = new D1LearningStore(db);
  legacyContentReady = initializeOnce(legacyContentReady, () => learningStore.seedContent(), () => {
    legacyContentReady = null;
  });
  await legacyContentReady;
  const gateway = new CourseIntelligenceModelGateway(
    repository,
    builtInModelConfig(env as unknown as Record<string, unknown>),
  );
  const service = new CourseIntelligenceService(repository, gateway, learningStore);
  courseCatalogReady = initializeOnce(courseCatalogReady, () => service.initialize(), () => {
    courseCatalogReady = null;
  });
  await courseCatalogReady;
  return service;
}

export function jsonError(error: unknown): Response {
  if (error instanceof z.ZodError) {
    return Response.json({ error: "请求内容不符合要求", issues: error.issues }, { status: 400 });
  }
  const status = error instanceof Error && "status" in error
    ? Number((error as { status?: number }).status) || 500
    : 500;
  if (status >= 500) {
    console.error("learning-api-error", error);
    return Response.json({ error: "服务暂时不可用，请稍后重试。" }, { status });
  }
  const message = error instanceof Error ? error.message : "请求失败";
  return Response.json({ error: message }, { status });
}
