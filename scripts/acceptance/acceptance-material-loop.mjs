// 合成材料端到端测试：真实浏览器/API/模型，不代替真人可用性观察。
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { findChrome } from "../lib/browser-cdp.mjs";
const require = createRequire(`${process.env.USERPROFILE}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json`);
const { chromium } = require("playwright");
const base = process.env.TRELLIS_BASE ?? "http://127.0.0.1:3411";
const owner = `material-loop-${Date.now()}`;
await mkdir("outputs/material-loop", { recursive: true });
const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, extraHTTPHeaders: { "x-trellis-owner-id": owner } });
const page = await context.newPage();
const errors = [];
const checks = [];
page.on("pageerror", error => errors.push(error.message));
async function post(path, data = {}) {
  const response = await context.request.post(`${base}${path}`, { data, timeout: 180000 });
  assert.ok(response.ok(), `${path} HTTP ${response.status()}: ${await response.text()}`);
  return response.json();
}
try {
  const { source } = await post("/api/learning/sources", {
    title: "合成课程：AI产品评估与能力边界", canonicalUrl: "https://example.com/trellis-synthetic-course",
    rawContent: "# 课程介绍\n本课程面向产品初学者，不需要编程基础，练习识别大模型能力边界和设计产品评估。\n# 第一章 AI能力边界\n识别模型输出中的事实错误、遗漏与不确定性，比较模型输出和原始资料。练习：记录十个输入样本，对每个回答核对事实依据。\n# 第二章 产品评估\n定义业务成功标准、模型失败分类与人工确认条件；使用未参与调试的样本检验改动，比较相同输入下的简单提示词基线。练习：提交一份含样本、评分依据和失败例的评估记录。",
  });
  const { analysis } = await post(`/api/learning/sources/${source.id}/analyze`);
  assert.equal(analysis.mode, "model");
  const fragments = analysis.fragments.filter(item => item.capabilityNodeIds.length);
  await post(`/api/learning/sources/${source.id}/confirm`, { fragmentIds: fragments.map(item => item.id), decision: "confirmed" });
  const adoption = await post(`/api/learning/sources/${source.id}/adopt`, { analysisVersion: analysis.version });
  assert.equal(adoption.status, "personal_ready", adoption.message);
  const courseId = adoption.matchedCourse.id;
  const { curriculum } = await post("/api/learning/intake", { goal: "理解AI能力边界并设计产品评估", weeklyCapacity: "light", materials: [] });
  assert.ok(curriculum.assembly.comparisons.some(item => item.courseId === courseId));
  const revised = await post(`/api/learning/curricula/${curriculum.id}/revise`, { constraints: [{ type: "pin_course", courseId }] });
  const next = revised.curriculum;
  assert.ok(next.assembly.segments.some(item => item.courseId === courseId));
  await post(`/api/learning/curricula/${next.id}/confirm`);
  checks.push({ name: "semantic-review-to-personal-course-to-confirmed-route", passed: true, courseId });
  await page.goto(`${base}/workbench`); await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "修改材料", exact: true }).click();
  const article = page.locator(".wb-source-objects article").first();
  await article.getByLabel("正文或目录", { exact: true }).fill("# 更新的材料\n先验证用户的问题，不承诺原课程章节仍然有效。");
  await article.getByRole("button", { name: "保存修改", exact: true }).click();
  await page.getByText("材料已更新。请重新分析、确认片段；当前路线保持原版本。", { exact: true }).waitFor();
  const stale = await context.request.post(`${base}/api/learning/sources/${source.id}/confirm`, { data: { fragmentIds: [fragments[0].id], decision: "confirmed" } });
  assert.equal(stale.status(), 409);
  const current = await (await context.request.get(`${base}/api/learning/current`)).json();
  assert.equal((current.current ?? current).curriculum.id, next.id);
  checks.push({ name: "ui-edit-invalidates-candidate-preserves-current", passed: true });
  await page.screenshot({ path: "outputs/material-loop/workbench-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "outputs/material-loop/workbench-mobile.png", fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  checks.push({ name: "mobile-workbench-no-overflow", passed: true });
  assert.deepEqual(errors, []);
} catch (error) {
  errors.push(error.message);
  throw error;
} finally {
  await writeFile("outputs/material-loop/result.json", JSON.stringify({ generatedAt: new Date().toISOString(), owner, passed: checks.length === 3 && errors.length === 0, checks, errors, kind: "synthetic-browser-model" }, null, 2));
  await browser.close();
}
console.log(JSON.stringify(checks));
