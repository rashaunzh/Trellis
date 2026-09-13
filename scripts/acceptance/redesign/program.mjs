import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { createReport } from "./report.mjs";
import { isolatedServer } from "./server.mjs";
import { findChrome } from "../../lib/browser-cdp.mjs";
import { programUnits, planLearningProgram, publicProgramUnit } from "../../../lib/learning/intelligence/learning-program.ts";

const run = await createReport("program", { mode: "authored-content-and-rule-planning", productIntegration: "reference-planning-plus-persisted-formative-checks" });
let browser, server;
try {
  await run.check("content-dependencies-and-assessment-coverage", () => {
    const seen = new Set();
    for (const unit of programUnits) {
      assert.ok(unit.prerequisites.every(id => seen.has(id)), `${unit.id}前置缺失或顺序不合法`);
      assert.ok(unit.lesson.length && unit.example && unit.practice && unit.rubric.length);
      for (const phase of ["diagnostic", "review"]) {
        assert.ok(unit.checks[phase].length >= 2);
        for (const question of unit.checks[phase]) assert.equal(question.options.filter(option => option.id === question.correctOptionId).length, 1);
      }
      assert.ok(!JSON.stringify(publicProgramUnit(unit.id)).includes("correctOptionId"));
      seen.add(unit.id);
    }
  });
  const routes = [];
  for (const direction of ["ai_literacy", "ai_product"]) for (const weeks of [8, 12]) for (const weeklyMinutes of [180, 240, 360]) {
    const input = { direction, weeks, weeklyMinutes };
    const plan = planLearningProgram(input);
    routes.push({ input, plan });
    await run.check(`${direction}-${weeks}-${weeklyMinutes}`, () => {
      assert.ok(plan.weeks.every(week => week.plannedMinutes <= week.capacityMinutes));
      if (plan.status === "ready") assert.ok(plan.coverage.every(unit => unit.status === "scheduled"));
      else assert.ok(plan.issues.length > 0);
      // 这是容量矩阵，不能冒充已实现不同起点的个性化。
      assert.ok(plan.assumptions.some(item => item.includes("起点未知")));
    });
  }
  await writeFile(resolve(run.directory, "reference-routes.json"), JSON.stringify(routes, null, 2));
  await writeFile(resolve(run.directory, "teaching-and-assessments.json"), JSON.stringify(programUnits, null, 2));
  if (process.argv.includes("--browser")) {
    const require = createRequire(process.env.TRELLIS_PLAYWRIGHT_PACKAGE ?? `${process.env.USERPROFILE}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json`);
    const { chromium } = require("playwright");
    server = await isolatedServer(run.directory);
    browser = await chromium.launch({ executablePath: findChrome(), headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const chainPassed = await run.check("prototype-plan-teaching-feedback", async () => {
      await page.goto(`${server.base}/internal/learning-program`);
      await page.getByRole("button", { name: "查看周期安排", exact: true }).click();
      await page.getByRole("heading", { name: "可进入内容审阅", exact: true }).waitFor();
      await page.getByRole("button", { name: "AI、机器学习与能力边界：讲解与示例", exact: true }).click();
      await page.getByLabel("明确金额条件的规则", { exact: true }).check();
      await page.getByLabel("只证明这些样本条件下的结果", { exact: true }).check();
      await page.getByRole("button", { name: "查看本次检查反馈", exact: true }).click();
      await page.getByRole("heading", { name: "本次检查通过", exact: true }).waitFor();
      await page.screenshot({ path: resolve(run.directory, "unit-desktop.png"), fullPage: true });
      await page.getByRole("button", { name: "切换另一组情景检查", exact: true }).click();
      await page.getByLabel("先训练需求预测", { exact: true }).check();
      await page.getByLabel("检查新领域样本及错误后果", { exact: true }).check();
      await page.getByRole("button", { name: "查看本次检查反馈", exact: true }).click();
      await page.getByRole("heading", { name: "需要针对性回看", exact: true }).waitFor();
    });
    if (!chainPassed) await page.screenshot({ path: resolve(run.directory, "prototype-failed.png"), fullPage: true });
    await run.check("prototype-mobile", async () => {
      assert.ok(chainPassed, "先完成实际活动链，不能用空白首屏代替手机活动验收");
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: resolve(run.directory, "unit-mobile.png"), fullPage: true });
    });
    await run.check("no-script-errors", () => assert.deepEqual(errors, []));
    await run.check("prototype-admin-boundary", async () => {
      const response = await page.request.post(`${server.base}/api/internal/course-intelligence/program`, { data: { action: "plan", request: { direction: "ai_product", weeks: 8, weeklyMinutes: 240 } } });
      assert.equal(response.status(), 403);
    });
    const owner = `program-browser-${crypto.randomUUID()}`;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, extraHTTPHeaders: { "x-trellis-owner-id": owner } });
    await context.addInitScript(value => { if (location.protocol === "http:") localStorage.setItem("trellis.anonymousOwnerId", value); }, owner);
    const learner = await context.newPage();
    learner.setDefaultTimeout(45000);
    learner.on("pageerror", error => errors.push(error.message));
    const requests = [];
    learner.on("response", response => { if (response.url().includes("/api/")) requests.push({ path: new URL(response.url()).pathname, status: response.status(), requestId: response.headers()["x-request-id"] ?? null }); });
    const saved = await run.check("learning-page-to-persisted-check", async () => {
      try {
        await learner.goto(`${server.base}/learn`);
        await learner.getByLabel("想学的方向").fill("没有编程基础，想理解AI产品能力边界");
        await learner.getByLabel("每周可用时间").selectOption("light");
        await learner.getByRole("button", { name: "生成学习路线", exact: true }).click();
        await learner.getByRole("button", { name: /^(确认并开始|先开始已覆盖的部分)$/ }).click();
        await learner.getByRole("link", { name: "讲解与理解检查", exact: true }).click();
        await learner.getByRole("heading", { name: "AI、机器学习与能力边界", exact: true }).waitFor();
        await learner.getByLabel("练习笔记（随检查保存，尚未评审）", { exact: true }).fill("按日期排序使用固定规则，识别投诉问题需要检查文本样本。");
        await learner.getByLabel("明确金额条件的规则", { exact: true }).check();
        await learner.getByLabel("只证明这些样本条件下的结果", { exact: true }).check();
        await learner.reload();
        assert.equal(await learner.getByLabel("明确金额条件的规则", { exact: true }).isChecked(), true);
        assert.ok((await learner.getByLabel("练习笔记（随检查保存，尚未评审）").inputValue()).includes("投诉问题"));
        await learner.getByRole("button", { name: "保存答案并查看反馈", exact: true }).click();
        await learner.locator("summary").filter({ hasText: "本次检查通过" }).waitFor();
        const rows = await server.inspectDatabase("SELECT * FROM learning_ci_learning_signals WHERE owner_id = ?", [owner]);
        assert.equal(rows.length, 1);
        await learner.screenshot({ path: resolve(run.directory, "persisted-lesson-desktop.png"), fullPage: true });
        await learner.reload();
        await learner.locator("summary").filter({ hasText: "本次检查通过" }).waitFor();
        await learner.getByRole("button", { name: "开始另一组检查", exact: true }).click();
        await learner.getByLabel("先训练需求预测", { exact: true }).check();
        await learner.getByLabel("检查新领域样本及错误后果", { exact: true }).check();
        await learner.getByRole("button", { name: "保存答案并查看反馈", exact: true }).click();
        await learner.locator("summary").filter({ hasText: "需要针对性回看" }).waitFor();
        assert.equal((await server.inspectDatabase("SELECT * FROM learning_ci_learning_signals WHERE owner_id = ?", [owner])).length, 2);
      } catch (error) { await learner.screenshot({ path: resolve(run.directory, "persisted-lesson-failed.png"), fullPage: true }); throw error; }
    });
    await run.check("persisted-check-restart-mobile-and-owner", async () => {
      assert.ok(saved, "先完成真实提交链");
      const url = learner.url();
      const id = decodeURIComponent(new URL(url).pathname.split("/").at(-1));
      await learner.goto("about:blank"); await server.restart(); await learner.goto(url);
      await learner.locator("summary").filter({ hasText: "需要针对性回看" }).waitFor();
      await learner.setViewportSize({ width: 390, height: 844 });
      assert.equal(await learner.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await learner.screenshot({ path: resolve(run.directory, "persisted-lesson-mobile.png"), fullPage: true });
      const denied = await page.request.post(`${server.base}/api/learning/runs/${encodeURIComponent(id)}/check?view=lesson`, { headers: { "x-trellis-owner-id": "unrelated-user" } });
      assert.equal(denied.status(), 404);
      await learner.goto(`${server.base}/workbench`);
      await learner.getByText("当前路线的材料、检查与成果", { exact: true }).click();
      const link = learner.getByRole("link", { name: "继续当前任务的讲解与理解检查", exact: true });
      await link.click();
      await learner.waitForURL(url);
      assert.equal(learner.url(), url);
    });
    await run.check("persisted-check-no-script-errors", () => assert.deepEqual(errors, []));
    await writeFile(resolve(run.directory, "program-requests.json"), JSON.stringify(requests, null, 2));
    await context.close();
  }
} catch (error) {
  run.report.checks.push({ id: "environment", status: "failed", error: error.message });
} finally {
  await browser?.close(); await server?.stop();
  run.report.pending = ["独立内容专家审核", "不同起点与材料的个性化", "正式路线与任务持久化接入", "成果评审修订", "真实模型路线与反馈试验", "真人与真实登录验收", "生产指标采集"];
  run.report.status = "completed"; await run.save();
  console.log(`内容与原型证据：${run.directory}`);
  process.exitCode = run.report.automatedPassed ? 2 : 1;
}
