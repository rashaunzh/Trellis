// 产品评估用探索性走查：记录失败，不边测边修产品，保留同一版本的问题全貌。
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createReport } from "./report.mjs";
import { isolatedServer } from "./server.mjs";
import { findChrome } from "../../lib/browser-cdp.mjs";

const run = await createReport("product-walkthrough", { mode: "exploratory-real-browser-baseline", productCommit: "22d941c", humanObservation: false });
const snapshots = [];
let server, browser, page;
try {
  const require = createRequire(process.env.TRELLIS_PLAYWRIGHT_PACKAGE ?? `${process.env.USERPROFILE}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json`);
  const { chromium } = require("playwright");
  server = await isolatedServer(run.directory);
  browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const owner = `pm-review-${crypto.randomUUID()}`;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, extraHTTPHeaders: { "x-trellis-owner-id": owner } });
  await context.addInitScript(id => { if (location.protocol === "http:") localStorage.setItem("trellis.anonymousOwnerId", id); }, owner);
  await context.route("**/*", route => new URL(route.request().url()).origin === server.base ? route.continue() : route.abort());
  page = await context.newPage(); page.setDefaultTimeout(20000);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  async function get(path) { const response = await context.request.get(server.base + path); assert.ok(response.ok()); return response.json(); }
  async function current() { const data = await get("/api/learning/current"); return data.current ?? data; }
  async function capture(id) {
    await page.screenshot({ path: resolve(run.directory, `${id}.png`), fullPage: true });
    snapshots.push({ id, url: page.url(), viewport: page.viewportSize(), text: await page.locator("body").innerText(), controls: await page.locator("button, input, select, textarea, a").evaluateAll(elements => elements.map(el => ({ tag: el.tagName, text: el.textContent?.trim(), label: el.getAttribute("aria-label"), href: el.getAttribute("href"), disabled: el.disabled ?? false }))) });
    await writeFile(resolve(run.directory, "screens.json"), JSON.stringify(snapshots, null, 2));
  }
  async function visit(path) { await page.goto(server.base + path); await page.waitForLoadState("networkidle"); }
  const check = (id, execute) => run.check(id, async () => { try { return await execute(); } catch (error) { await capture(`${id}-failed`); throw error; } });
  for (const route of ["learn", "grow", "workbench", "product"]) await check(`empty-${route}`, async () => {
    await visit(`/${route}`); await capture(`empty-${route}`);
    assert.ok((await page.locator("body").innerText()).length > 100);
    assert.equal(await page.locator("vite-error-overlay").count(), 0);
  });
  await check("route-review-and-confirm", async () => {
    await visit("/learn");
    await page.getByLabel("想学的方向").fill("没有编程基础，希望学会判断客服AI方案是否可靠，能够设计失败案例与人工兜底");
    await page.getByLabel("每周可用时间").selectOption("light");
    await page.getByRole("button", { name: "生成学习路线", exact: true }).click();
    await page.getByRole("button", { name: /^(确认并开始|先开始已覆盖的部分)$/ }).waitFor({ timeout: 60000 });
    await capture("route-review");
    await page.getByRole("button", { name: /^(确认并开始|先开始已覆盖的部分)$/ }).click();
    await page.getByRole("button", { name: "开始这一节", exact: true }).waitFor({ timeout: 45000 });
    await capture("learn-active");
  });
  await check("feedback-input-refresh", async () => {
    await page.getByRole("button", { name: "学习反馈", exact: true }).click();
    await page.getByLabel("补充一句（可选）").fill("尚未保存：我不懂为什么客服错误需要人工兜底");
    await capture("feedback-edit");
    await page.reload(); await page.getByRole("button", { name: "学习反馈", exact: true }).click();
    assert.equal(await page.getByLabel("补充一句（可选）").inputValue(), "尚未保存：我不懂为什么客服错误需要人工兜底", "未提交反馈应可恢复");
  });
  await visit("/learn");
  await check("scenario-and-completion", async () => {
    await page.getByRole("button", { name: "学习反馈", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "留下学习反馈" });
    await capture("feedback-options");
    const scenarioButton = dialog.getByRole("button", { name: /情景|判断题/ });
    if (await scenarioButton.count() === 1) { await scenarioButton.click(); await page.waitForLoadState("networkidle"); await capture("scenario-question"); }
    await dialog.getByLabel("补充一句（可选）").fill("我看完了材料，但尚不能独立解释客服失败时怎样接管");
    await dialog.getByLabel("片段状态").selectOption("complete");
    await dialog.getByRole("button", { name: /保存并查看结果/ }).click();
    await dialog.locator(".cl-task-result, .cl-summary-change").first().waitFor();
    await capture("feedback-saved");
    const state = await current();
    await writeFile(resolve(run.directory, "current-after-feedback.json"), JSON.stringify(state, null, 2));
    assert.ok(state.activities.some(item => item.status === "completed"));
    assert.ok(state.knowledgeStates.every(item => item.status !== "confirmed"));
  });
  await check("grow-details-keyboard", async () => {
    await visit("/grow"); await capture("grow-active");
    await page.locator(".grow-node").first().click(); await capture("grow-node-detail");
    assert.equal(await page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement)), true, "成长详情弹窗应接收焦点");
    await page.keyboard.press("Escape"); assert.equal(await page.getByRole("dialog").count(), 0);
  });
  await check("workbench-test-actions", async () => {
    await visit("/workbench");
    for (const details of await page.locator("details").all()) { if (!await details.getAttribute("open")) await details.locator(":scope > summary").click(); }
    await capture("workbench-expanded");
    const cards = page.locator(".wb-test-grid article");
    const count = await cards.count();
    assert.ok(count > 0, "应提供当前可进行的检查");
    assert.ok(await cards.locator("button, a").count() > 0, "测试卡应有实际开始入口");
  });
  for (const route of ["learn", "grow", "workbench"]) await check(`mobile-${route}`, async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await visit(`/${route}`); await capture(`mobile-${route}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "390px页面不能横向溢出");
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await check("unconfirmed-route-map-consistency", async () => {
    const before = await current();
    await visit("/learn"); await page.getByRole("button", { name: "重新说明目标", exact: true }).click();
    await page.getByLabel("想学的方向").fill("我有Python经验，希望学习神经网络训练与深度学习模型开发");
    await page.getByRole("button", { name: "生成学习路线", exact: true }).click();
    await page.getByRole("button", { name: /^(确认并开始|先开始已覆盖的部分)$/ }).waitFor({ timeout: 60000 });
    await visit("/grow"); await capture("grow-unconfirmed-draft");
    assert.equal((await current()).curriculum.id, before.curriculum.id, "正式路线未确认不能改变");
    const shownCount = Number(await page.locator(".grow-metrics b").nth(1).innerText());
    assert.equal(shownCount, before.curriculum.assembly.targetNodeIds.length, "标为当前路线的地图应展示正式路线，而不是未确认草稿");
  });
  await check("no-page-errors", () => assert.deepEqual(errors, []));
} catch (error) { run.report.checks.push({ id: "environment", status: "failed", error: error.message }); }
finally {
  await browser?.close(); await server?.stop();
  run.report.status = "completed"; await run.save(); console.log(`产品走查证据：${run.directory}`);
  process.exitCode = run.report.automatedPassed ? 0 : 1;
}
