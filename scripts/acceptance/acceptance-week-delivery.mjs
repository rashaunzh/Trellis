// 使用独立测试 owner，不重置个人学习数据。依赖桌面内置 Playwright。
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { findChrome } from "../lib/browser-cdp.mjs";
const require = createRequire(`${process.env.USERPROFILE}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json`);
const { chromium } = require("playwright");
const base = process.env.TRELLIS_BASE ?? "http://127.0.0.1:3410";
await mkdir("outputs/week-delivery", { recursive: true });
const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
const owner = `week-browser-${Date.now()}`;
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, extraHTTPHeaders: { "x-trellis-owner-id": owner } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const checks = [];
async function post(path, data = {}) {
  const response = await context.request.post(`${base}${path}`, { data, timeout: 120000 });
  if (!response.ok()) throw new Error(`${path}: ${response.status()} ${await response.text()}`);
  return response.json();
}
try {
  for (const route of ["learn", "workbench", "grow"]) {
    await page.goto(`${base}/${route}`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `outputs/week-delivery/${route}-desktop.png`, fullPage: true });
    checks.push({ route, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), title: await page.locator("h1").first().textContent() });
  }
  const { source } = await post("/api/learning/sources", { title: "演示材料 · AI 能力边界", rawContent: "# AI 能力边界\n解释 AI 能力边界，识别不确定性。\n# Agent\nAgent 工具调用需要人工确认。" });
  const { analysis } = await post(`/api/learning/sources/${source.id}/analyze`);
  await post(`/api/learning/sources/${source.id}/confirm`, { fragmentIds: [analysis.fragments[0].id], decision: "confirmed" });
  const { curriculum } = await post("/api/learning/intake", { goal: "理解 AI 产品能力边界", weeklyCapacity: "light", materials: [] });
  checks.push({ route: "source-to-route", passed: curriculum.assembly.sourceSelections?.length === 1 });
  await page.goto(`${base}/learn`); await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "outputs/week-delivery/proposal.png", fullPage: true });
  await post(`/api/learning/curricula/${curriculum.id}/confirm`);
  const currentResponse = await context.request.get(`${base}/api/learning/current`);
  const currentPayload = await currentResponse.json();
  const current = currentPayload.current ?? currentPayload;
  const activity = current.activities[0];
  await post(`/api/learning/runs/${activity.id}/feedback`, { type: "understanding", value: "uncertain", note: "还不能解释边界" });
  await page.goto(`${base}/learn`); await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "outputs/week-delivery/current.png", fullPage: true });
  await page.goto(`${base}/workbench`); await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "outputs/week-delivery/materials.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/learn`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "outputs/week-delivery/learn-mobile.png", fullPage: true });
  checks.push({ route: "learn-mobile", overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
  for (const route of ["records", "concepts", "reviews?weekKey=2026-W36"]) {
    const response = await context.request.get(`${base}/api/${route}`);
    checks.push({ route, status: response.status(), passed: response.status() === 410 });
  }
  await writeFile("outputs/week-delivery/browser.json", JSON.stringify({ generatedAt: new Date().toISOString(), owner, checks, errors, kind: "automated-not-human" }, null, 2));
  console.log(JSON.stringify({ checks, errors }));
  if (errors.length || checks.some(item => item.overflow || item.passed === false)) process.exitCode = 1;
} finally { await browser.close(); }
