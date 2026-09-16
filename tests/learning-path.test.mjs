import assert from "node:assert/strict";
import test from "node:test";

const moduleUrl = new URL("../dist/server/index.js", import.meta.url);

test("内容包与路径规则编译进服务端", async () => {
  const source = await import(moduleUrl.href + `?learning=${Date.now()}`);
  assert.ok(source.default,"构建产物应暴露 Worker");
});
