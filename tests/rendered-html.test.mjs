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

test("renders the Trellis adaptive learning MVP entry", async () => {
  const response = await renderHome();
  const html = await response.text();
  assert.match(html,/Trellis/);
  assert.match(html,/正在准备你的学习环境/);
});

test("renders the independent Chinese learning entry", async () => {
  const response = await renderPath("/learn");
  const html = await response.text();
  assert.equal(response.status,200);
  assert.match(html,/正在准备你的学习环境/);
});

test("serves the validated AI literacy content pack", async () => {
  const response = await renderPath("/api/learning/content");
  const data = await response.json();
  assert.equal(response.status,200);
  assert.equal(data.contentPack.能力.length,6);
  assert.equal(data.contentPack.诊断题.length,6);
  assert.equal(data.contentPack.建议分钟下限,720);
  assert.equal(data.contentPack.版本,"1.1.0");
  assert.equal(data.contentPack.能力[0].关键概念.length,4);
});

test("redirects the default entry to the new learning MVP", async () => {
  const response = await renderPath("/");
  assert.ok([307,308].includes(response.status));
  assert.equal(new URL(response.headers.get("location")).pathname,"/learn");
});
