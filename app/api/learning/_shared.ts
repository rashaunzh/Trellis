// 共享：ownerId 解析 + 服务工厂（V0.2 单用户 MVP 用固定 owner）
import { LearningApplicationService } from "../../../lib/learning/application/learning-service.ts";
import { D1LearningStore } from "../../../lib/learning/persistence/d1.ts";
import { createRuleAgents } from "../../../lib/learning/agents/index.ts";
import { CourseIntelligenceService } from "../../../lib/learning/intelligence/service.ts";
import { createCourseIntelligenceContext } from "../../../lib/learning/intelligence/runtime-context.ts";
import type { D1CourseIntelligenceRepository } from "../../../lib/learning/intelligence/repository.ts";
import { z } from "zod";

// 托管环境只接受 ChatGPT 注入的身份。匿名 owner header 仅供本机开发和自动化验收。
export const DEFAULT_OWNER = "trellis-owner";

const OWNER_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const AUTHENTICATED_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let legacyContentReady: Promise<void> | null = null;
let courseContextReady: ReturnType<typeof createCourseIntelligenceContext> | null = null;

function initializeOnce(current: Promise<void> | null, work: () => Promise<void>, reset: () => void): Promise<void> {
  if (current) return current;
  const pending = work().catch((error) => {
    reset();
    throw error;
  });
  return pending;
}

export async function ownerOf(request: Request): Promise<string> {
  const authenticatedEmail = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (authenticatedEmail && authenticatedEmail.length <= 320 && AUTHENTICATED_EMAIL_PATTERN.test(authenticatedEmail)
    && await isTrustedManagedIdentityRequest(request)) {
    const canonicalOwnerId = `chatgpt-${await stableOwnerHash(authenticatedEmail)}`;
    await migrateLegacyOwnerId(`chatgpt-${legacyOwnerHash(authenticatedEmail)}`, canonicalOwnerId);
    return canonicalOwnerId;
  }
  if (isLocalRequest(request)) {
    const header = request.headers.get("x-trellis-owner-id");
    return header && OWNER_ID_PATTERN.test(header) ? header : DEFAULT_OWNER;
  }
  throw Object.assign(new Error("需要通过 ChatGPT 登录后访问学习数据。"), { status: 401 });
}

async function isTrustedManagedIdentityRequest(request: Request): Promise<boolean> {
  if (isLocalRequest(request)) return true;
  let workerModule: typeof import("cloudflare:workers");
  try {
    workerModule = await import("cloudflare:workers");
  } catch {
    return false;
  }
  const runtimeEnv = workerModule.env as unknown as Record<string, unknown>;
  if (String(runtimeEnv.TRELLIS_IDENTITY_MODE ?? "") !== "chatgpt-hosted") return false;
  const hostname = new URL(request.url).hostname.toLowerCase();
  if (hostname.endsWith(".workers.dev")) return false;
  const trustedHosts = String(runtimeEnv.TRELLIS_TRUSTED_HOSTS ?? "")
    .split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return trustedHosts.includes(hostname);
}

export async function requireLegacyRuntime(request: Request): Promise<void> {
  if (!isLocalRequest(request)) {
    throw Object.assign(new Error("该接口属于历史学习运行时，正式产品已迁移到课程智能与 Learning Signal。"), { status: 410 });
  }
  const explicitlyEnabled = request.headers.get("x-trellis-legacy-runtime") === "true";
  let envEnabled = false;
  try {
    const { env } = await import("cloudflare:workers");
    envEnabled = String((env as unknown as Record<string, unknown>).TRELLIS_ENABLE_LEGACY_RUNTIME ?? "") === "1";
  } catch {
    // Node domain tests have no Cloudflare env; the explicit header remains available.
  }
  if (!explicitlyEnabled && !envEnabled) {
    throw Object.assign(new Error("历史学习运行时默认关闭；本机兼容验收需显式启用。"), { status: 410 });
  }
}

export async function requireCourseIntelligenceAdmin(request: Request): Promise<string> {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (email && AUTHENTICATED_EMAIL_PATTERN.test(email)) {
    const { env } = await import("cloudflare:workers");
    const allowed = String((env as unknown as Record<string, unknown>).TRELLIS_ADMIN_EMAILS ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.includes(email)) return await ownerOf(request);
  }
  if (isLocalRequest(request) && request.headers.get("x-trellis-admin") === "true") {
    return await ownerOf(request);
  }
  throw Object.assign(new Error("没有课程内容评审权限。"), { status: 403 });
}

async function stableOwnerHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest).slice(0, 16))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isLocalRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

async function migrateLegacyOwnerId(legacyOwnerId: string, canonicalOwnerId: string): Promise<void> {
  if (legacyOwnerId === canonicalOwnerId) return;
  let workerModule: typeof import("cloudflare:workers");
  try {
    workerModule = await import("cloudflare:workers");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ERR_UNSUPPORTED_ESM_URL_SCHEME") return;
    throw error;
  }
  const { env } = workerModule;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (env as any).DB;
  if (!db) return;
  const known = await db.prepare("SELECT canonical_owner_id FROM learning_owner_aliases WHERE legacy_owner_id=? LIMIT 1")
    .bind(legacyOwnerId).first();
  if (known) return;
  const canonicalExists = await db.prepare(`SELECT owner_id FROM learning_profiles WHERE owner_id=?
    UNION SELECT owner_id FROM learning_ci_curricula WHERE owner_id=? LIMIT 1`)
    .bind(canonicalOwnerId, canonicalOwnerId).first();
  const tables = [
    "learning_diagnostics", "learning_path_proposals", "learning_mvp_states",
    "learning_activities", "learning_adjustments", "learning_evidence",
    "learning_node_progress", "learning_weekly_plans", "learning_profiles",
    "learning_api_config", "learning_user_resources", "learning_week_reviews",
    "learning_ci_curricula", "learning_ci_analysis_runs", "learning_ci_knowledge_states",
    "learning_ci_learning_signals", "learning_ci_course_candidates", "learning_workflow_runs",
    "learning_decisions",
  ];
  const statements = canonicalExists
    ? []
    : tables.map((table) => db.prepare(`UPDATE ${table} SET owner_id=? WHERE owner_id=?`)
      .bind(canonicalOwnerId, legacyOwnerId));
  statements.push(db.prepare(`INSERT INTO learning_owner_aliases
    (legacy_owner_id,canonical_owner_id) VALUES (?,?)
    ON CONFLICT(legacy_owner_id) DO NOTHING`).bind(legacyOwnerId, canonicalOwnerId));
  await db.batch(statements);
}

function legacyOwnerHash(value: string): string {
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
  return (await getCourseIntelligenceContext()).service;
}

export async function getCourseIntelligenceContext(): Promise<{
  service: CourseIntelligenceService;
  repository: D1CourseIntelligenceRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}> {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = env.DB as any;
  if (!courseContextReady) {
    courseContextReady = createCourseIntelligenceContext(db, env as unknown as Record<string, unknown>)
      .catch((error) => {
        courseContextReady = null;
        throw error;
      });
  }
  return courseContextReady;
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
