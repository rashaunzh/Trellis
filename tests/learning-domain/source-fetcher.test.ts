import test from "node:test";
import assert from "node:assert/strict";

import { assertPublicSourceUrl, fetchPublicSource } from "../../lib/learning/intelligence/source-fetcher.ts";

test("课程来源拒绝本机、私网、认证信息和自定义端口", () => {
  for (const url of [
    "http://example.com/course",
    "https://localhost/course",
    "https://127.0.0.1/course",
    "https://10.0.0.8/course",
    "https://user:pass@example.com/course",
    "https://example.com:8443/course",
  ]) {
    assert.throws(() => assertPublicSourceUrl(url));
  }
});

test("课程来源每次重定向都会重新检查 SSRF", async () => {
  const fakeFetch: typeof fetch = async () => new Response(null, {
    status: 302,
    headers: { location: "https://192.168.1.5/admin" },
  });
  await assert.rejects(fetchPublicSource("https://example.com/course", fakeFetch), /私有网络/);
});

test("课程来源限制响应大小和内容类型", async () => {
  const oversized: typeof fetch = async () => new Response("x", {
    headers: { "content-type": "text/html", "content-length": "1000001" },
  });
  await assert.rejects(fetchPublicSource("https://example.com/course", oversized), /大小限制/);

  const binary: typeof fetch = async () => new Response("binary", {
    headers: { "content-type": "application/octet-stream" },
  });
  await assert.rejects(fetchPublicSource("https://example.com/course", binary), /内容类型/);
});
