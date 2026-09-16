import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function renderPath(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers:{ accept:"text/html" } }),
    { ASSETS:{ fetch:async () => new Response("Not found",{status:404}) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function renderHome() { return renderPath("/learn"); }

test("renders development preview metadata", async () => {
  const response = await renderHome();
  assert.equal(response.status,200);
  assert.match(response.headers.get("content-type") ?? "",/^text\/html\b/i);
  assert.match(await response.text(),developmentPreviewMeta);
});

test("renders the Trellis learning orchestration entry", async () => {
  const response = await renderHome();
  const html = await response.text();
  assert.match(html,/Trellis/);
  assert.match(html,/正在恢复你的学习状态/);
  assert.match(html,/本周任务包/);
  assert.match(html,/学习处境编排/);
});

test("renders the Chinese course-intelligence loading state", async () => {
  const response = await renderPath("/learn");
  const html = await response.text();
  assert.equal(response.status,200);
  assert.match(html,/正在恢复你的学习状态/);
});

test("build artifact includes V0.2 API routes", async () => {
  // workspace/收集箱等端到端由 test:domain + 浏览器验收覆盖；
  // 这里验证 build 产物确实打包了 V0.2 闭环路由。
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const serverFile = path.join(testDir, "..", "dist", "server", "index.js");
  const src = fs.readFileSync(serverFile, "utf-8");
  for (const route of [
    "api/learning/intelligence/state",
    "api/learning/intake",
    "api/learning/materials/analyze",
    "api/learning/curricula/:id",
    "api/learning/curricula/:id/confirm",
    "api/learning/runs/:id/start",
    "api/learning/runs/:id/pause",
    "api/learning/runs/:id/location",
    "api/learning/resources/:id/attachments",
    "api/learning/orchestration",
    "api/learning/situation/diagnose",
    "api/learning/sources/triage",
    "api/learning/packages/generate",
    "api/learning/assessments/submit",
    "api/learning/artifacts/review",
  ]) {
    assert.ok(src.includes(route), `build 产物应包含路由 ${route}`);
  }
});

test("redirects the default entry to the new learning MVP", async () => {
  const response = await renderPath("/");
  assert.ok([307,308].includes(response.status));
  assert.equal(new URL(response.headers.get("location")).pathname,"/learn");
});
