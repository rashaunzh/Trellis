// Cloudflare Workers 运行时类型声明（自包含，不引入 @cloudflare/workers-types 全量全局，
// 避免与 lib.dom 的 Request/Response/Event 等标识符冲突）。
// 覆盖两处使用：
//   1) `import("cloudflare:workers")` 动态导入（app/api/learning/_shared.ts、db/index.ts）
//   2) worker/index.ts 的 Fetcher / D1Database 全局类型
// 形状按实际使用面最小化；D1 精确类型仓库约定用 any 桥接（见 _shared.ts 注释）。

declare module "cloudflare:workers" {
  const env: {
    DB: D1Database;
    [key: string]: unknown;
  };
  export { env };
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]>;
  exec(sql: string): Promise<{ count: number; duration: number }>;
  dump(): Promise<ArrayBuffer>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T>;
  run<T = unknown>(): Promise<{ success: boolean; meta: Record<string, unknown>; results?: T[] }>;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta: Record<string, unknown> }>;
  raw<T = unknown>(): Promise<T[]>;
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}
