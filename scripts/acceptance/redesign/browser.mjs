import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { findChrome } from "../../lib/browser-cdp.mjs";
import { createReport } from "./report.mjs";
import { isolatedServer } from "./server.mjs";

const run = await createReport("browser", { mode: "real-browser-local-d1", diagnosticOnly: true, databaseVerification: "direct-sqlite-readback-and-server-restart", humanTiming: "not_measured" });
let server, browser;
const requests = [];
try {
  const require = createRequire(process.env.TRELLIS_PLAYWRIGHT_PACKAGE ?? `${process.env.USERPROFILE}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json`);
  const { chromium } = require("playwright");
  server = await isolatedServer(run.directory);
  run.report.base = server.base;
  run.report.statePath = server.statePath;
  browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  async function scenario(name, execute) {
    const owner = `redesign-${name}-${crypto.randomUUID()}`;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, extraHTTPHeaders: { "x-trellis-owner-id": owner } });
    await context.addInitScript(value => { if (location.protocol === "http:") localStorage.setItem("trellis.anonymousOwnerId", value); }, owner);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => { if (response.url().includes("/api/")) requests.push({ scenario: name, method: response.request().method(), path: new URL(response.url()).pathname, status: response.status(), requestId: response.headers()["x-request-id"] ?? null }); });
    // 材料链接可以打开新标签，但验收不访问外部课程或发送用户输入。
    await context.route("**/*", route => new URL(route.request().url()).origin === server.base ? route.continue() : route.abort());
    async function current() {
      const response = await context.request.get(`${server.base}/api/learning/current`);
      assert.ok(response.ok()); const data = await response.json(); return data.current ?? data;
    }
    const step = async (id, fn) => run.check(`${name}/${id}`, async () => {
      try { return await fn(); }
      catch (error) { await page.screenshot({ path: resolve(run.directory, `${name}-${id}-failed.png`), fullPage: true }).catch(() => {}); throw error; }
    });
    try {
      await execute({ page, context, current, step, owner });
      await step("no-script-errors", () => assert.deepEqual(errors, []));
    } finally { await context.close(); }
  }
  async function intake(page) {
    await page.goto(`${server.base}/learn`);
    await page.getByLabel("想学的方向").fill("没有编程基础，想理解AI产品能力边界");
    await page.getByLabel("每周可用时间").selectOption("light");
    await page.getByRole("button", { name: "生成学习路线", exact: true }).click();
    await page.getByRole("button", { name: /^(确认并开始|先开始已覆盖的部分)$/ }).waitFor({ timeout: 60000 });
    assert.equal(await page.locator("vite-error-overlay, [data-nextjs-dialog]").count(), 0);
    await page.getByRole("button", { name: /^(确认并开始|先开始已覆盖的部分)$/ }).click();
    await page.getByRole("button", { name: "开始这一节", exact: true }).waitFor({ timeout: 45000 });
  }
  async function feedback(page, uncertain = true) {
    await page.getByRole("button", { name: "学习反馈", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "留下学习反馈" });
    if (uncertain) await dialog.getByRole("button", { name: "还不确定", exact: true }).click();
    await dialog.getByLabel("补充一句（可选）").fill("我能说明可能的收益，但还不能解释失败时怎么办。");
    await dialog.getByLabel("片段状态").selectOption(uncertain ? "keep_open" : "complete");
    await dialog.getByRole("button", { name: /保存并查看结果/ }).click();
    await dialog.locator(".cl-task-result, .cl-feedback-summary, .cl-summary-change").first().waitFor();
    return dialog;
  }
  await scenario("zero", async ({ page, current, step }) => {
    if (!await step("input-confirm-start", async () => {
      await intake(page);
      const visible = await page.locator("body").innerText();
      for (const nodeId of (await current()).curriculum.assembly.targetNodeIds) assert.ok(!visible.includes(nodeId), `界面不应暴露内部能力编号 ${nodeId}`);
      assert.ok(!/置信度\s*\d+%/.test(visible));
      await page.screenshot({ path: resolve(run.directory, "zero-desktop.png"), fullPage: true });
      await page.getByRole("button", { name: "开始这一节", exact: true }).click();
      await page.getByRole("button", { name: "暂停", exact: true }).waitFor();
      assert.equal((await current()).activities[0].status, "in_progress");
    })) return;
    const activityId = (await current()).activities[0].id;
    if (!await step("feedback-refresh", async () => {
      const dialog = await feedback(page);
      assert.ok(!/\d+%/.test(await dialog.innerText()), "反馈不得显示未经校准的置信度百分比");
      await dialog.getByText("你这次记录", { exact: false }).waitFor();
      const before = await current();
      assert.equal(before.activities.find(item => item.id === activityId).status, "in_progress");
      await page.reload();
      await page.getByRole("button", { name: "学习反馈", exact: true }).waitFor();
      assert.equal((await current()).resumeState.activityId, activityId);
    })) return;
    await step("restart-persistence", async () => {
      const before = await current(); await page.goto("about:blank"); await server.restart(); await page.goto(`${server.base}/learn`);
      await page.getByRole("button", { name: "学习反馈", exact: true }).waitFor();
      const after = await current();
      assert.equal(after.curriculum.id, before.curriculum.id);
      assert.deepEqual(after.activities, before.activities);
    });
    await step("mobile-and-keyboard", async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: resolve(run.directory, "zero-mobile.png"), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.getByRole("button", { name: "学习反馈", exact: true }).click();
      assert.equal(await page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement)), true, "打开弹窗应移入焦点");
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").count(), 0, "Escape 应关闭弹窗");
    });
  });
  await scenario("feedback-purpose", async ({ page, current, step, owner }) => {
    if (!await step("draft-refresh-and-time-constraint", async () => {
      await intake(page);
      const activity = (await current()).activities[0];
      await page.getByRole("button", { name: "学习反馈", exact: true }).click();
      let dialog = page.getByRole("dialog", { name: "留下学习反馈" });
      await dialog.getByRole("button", { name: "时间不足", exact: true }).click();
      await dialog.getByLabel("补充一句（可选）").fill("这周只剩半小时，先保留当前任务");
      await dialog.getByLabel("实际用时").fill("15");
      await page.reload();
      await page.getByRole("button", { name: "学习反馈", exact: true }).click();
      dialog = page.getByRole("dialog", { name: "留下学习反馈" });
      assert.equal(await dialog.getByLabel("补充一句（可选）").inputValue(), "这周只剩半小时，先保留当前任务");
      assert.equal(await dialog.getByLabel("实际用时").inputValue(), "15");
      assert.match(await dialog.getByRole("button", { name: "时间不足", exact: true }).getAttribute("class"), /active/);
      await dialog.getByRole("button", { name: /保存并查看结果/ }).click();
      await dialog.locator(".cl-task-result").waitFor();
      const saved = (await current()).activities.find(item => item.id === activity.id);
      assert.equal(saved.estimatedMinutes, activity.estimatedMinutes);
      assert.equal(saved.steps, activity.steps);
      assert.equal(saved.status, "in_progress");
      await dialog.getByRole("button", { name: "关闭", exact: true }).click();
    })) return;
    await step("self-reported-quiz-keeps-original-value", async () => {
      await page.getByRole("button", { name: "查看上次反馈", exact: true }).click();
      let dialog = page.getByRole("dialog", { name: "留下学习反馈" });
      await dialog.locator(".cl-task-result").waitFor();
      await dialog.getByRole("button", { name: "关闭", exact: true }).click();
      await page.getByRole("button", { name: "学习反馈", exact: true }).click();
      dialog = page.getByRole("dialog", { name: "留下学习反馈" });
      await dialog.getByRole("button", { name: "通过", exact: true }).click();
      await dialog.getByLabel("片段状态").selectOption("keep_open");
      await dialog.getByRole("button", { name: /保存并查看结果/ }).click();
      await dialog.locator(".cl-task-result").waitFor();
      assert.ok((await dialog.innerText()).includes("自报"));
      const rows = await server.inspectDatabase("SELECT value_json FROM learning_ci_learning_signals WHERE owner_id = ? AND signal_type = 'quiz_report'", [owner]);
      assert.equal(rows.length, 1); assert.equal(JSON.parse(rows[0].value_json), "passed");
      await dialog.getByRole("button", { name: "关闭", exact: true }).click();
    });
    await step("completion-without-mastery", async () => {
      const activity = (await current()).activities[0];
      await page.getByRole("button", { name: "学习反馈", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "留下学习反馈" });
      await dialog.getByRole("button", { name: "完成但尚未验证", exact: true }).click();
      await dialog.getByRole("button", { name: /保存并查看结果/ }).click();
      await dialog.locator(".cl-task-result").waitFor();
      assert.ok((await dialog.innerText()).includes("未验证"));
      assert.equal((await current()).activities.find(item => item.id === activity.id).status, "completed");
      const rows = await server.inspectDatabase("SELECT signal_type, value_json FROM learning_ci_learning_signals WHERE owner_id = ?", [owner]);
      assert.equal(rows.filter(item => item.signal_type === "completion_report").length, 1);
      assert.equal(rows.filter(item => item.signal_type === "time_constraint").length, 1);
    });
  });
  await scenario("grow-confirmed", async ({ page, current, step }) => {
    if (!await step("confirm-and-dialog", async () => {
      await intake(page);
      await page.goto(`${server.base}/grow`);
      const node = page.locator(".grow-node").first();
      await node.click();
      const dialog = page.getByRole("dialog");
      assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true);
      assert.ok(!/映射置信度|最近信号 signal\.|等级 \d\/3/.test(await page.locator("body").innerText()));
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assert.equal(await node.evaluate(element => document.activeElement === element), true);
    })) return;
    await step("draft-does-not-replace-growth", async () => {
      const before = await page.locator(".grow-node strong").allTextContents();
      const confirmedId = (await current()).curriculum.id;
      await page.goto(`${server.base}/learn`);
      await page.getByRole("button", { name: "重新说明目标", exact: true }).click();
      await page.getByLabel("想学的方向").fill("想学习Agent工具调用和部署");
      await page.getByRole("button", { name: "生成学习路线", exact: true }).click();
      await page.getByRole("button", { name: /^(确认并开始|先开始已覆盖的部分)$/ }).waitFor({ timeout: 60000 });
      await page.goto(`${server.base}/grow`);
      await page.locator(".grow-node").first().waitFor();
      assert.deepEqual(await page.locator(".grow-node strong").allTextContents(), before);
      assert.equal((await current()).curriculum.id, confirmedId);
    });
  });
  await scenario("materials", async ({ page, context, current, step }) => {
    if (!await step("add-analyze-review", async () => {
      await page.goto(`${server.base}/workbench`);
      await page.waitForLoadState("networkidle");
      await page.getByLabel("名称", { exact: true }).fill("合成验收材料：AI边界");
      await page.getByLabel("材料正文或课程目录").fill("解释AI能力边界与不确定性，核验资料中的事实错误，不把语言流畅视为正确，不把课程营销看作能力证据。");
      await page.getByRole("button", { name: "进入来源中心", exact: true }).click();
      await page.getByRole("button", { name: "读取并分析", exact: true }).click();
      const fragment = page.locator(".wb-fragment").first();
      await fragment.locator("summary").click();
      await fragment.getByRole("button", { name: "确认作为路线候选", exact: true }).click();
      await fragment.locator("summary").filter({ hasText: "已确认" }).waitFor();
      await intake(page);
      assert.ok((await current()).curriculum.assembly.sourceSelections.length > 0);
    })) return;
    await step("location-persists", async () => {
      await page.getByRole("button", { name: /补充.*位置/ }).first().click();
      const dialog = page.getByRole("dialog", { name: "补充准确位置" });
      await dialog.getByLabel("章节链接").fill("https://redesign.invalid/chapter-1");
      await dialog.getByLabel("位置说明").fill("合成位置：第一章第2节");
      await dialog.getByRole("button", { name: "保存位置", exact: true }).click();
      await dialog.waitFor({ state: "hidden" }); await page.reload();
      assert.equal((await current()).activities[0].scope.locatorLabel, "合成位置：第一章第2节");
    });
    if (!await step("complete-and-adjust", async () => {
      const dialog = await feedback(page, false);
      await dialog.getByRole("button", { name: "关闭", exact: true }).click();
      await page.getByRole("button", { name: "路线管理", exact: true }).first().click();
      const routeDialog = page.getByRole("dialog", { name: "路线管理" });
      await routeDialog.getByRole("button", { name: "暂不采用", exact: true }).first().click();
      await page.getByText("已生成新的方案版本，原方案和学习记录仍保留。", { exact: true }).waitFor();
      await routeDialog.getByRole("button", { name: "关闭", exact: true }).click();
    })) return;
    const confirmedId = (await current()).curriculum.id;
    if (!await step("reject-preserves-current", async () => {
      await page.getByRole("button", { name: "保留当前路线", exact: true }).click();
      await page.getByText("已保留当前路线", { exact: false }).waitFor();
      await page.reload(); assert.equal((await current()).curriculum.id, confirmedId);
    })) return;
    await step("confirm-adjustment", async () => {
      await page.getByRole("button", { name: "路线管理", exact: true }).first().click();
      const dialog = page.getByRole("dialog", { name: "路线管理" });
      await dialog.getByRole("button", { name: "暂不采用", exact: true }).first().click();
      await page.getByText("已生成新的方案版本，原方案和学习记录仍保留。", { exact: true }).waitFor();
      await dialog.getByRole("button", { name: "关闭", exact: true }).click();
      await page.getByRole("button", { name: /^(确认并开始|先开始已覆盖的部分)$/ }).click();
      await page.getByRole("button", { name: /开始这一节|继续这一节/, exact: true }).waitFor();
      await page.reload(); assert.notEqual((await current()).curriculum.id, confirmedId);
    });
    await step("owner-isolation", async () => {
      const id = (await current()).activities[0].id;
      const response = await context.request.get(`${server.base}/api/learning/tasks/${id}/result`, { headers: { "x-trellis-owner-id": "redesign-other-owner" } });
      assert.equal(response.status(), 404);
    });
  });
  await scenario("recovery", async ({ page, context, current, step, owner }) => {
    const signalCount = async () => Number((await server.inspectDatabase("SELECT COUNT(*) AS count FROM learning_ci_learning_signals WHERE owner_id=?", [owner]))[0].count);
    await step("input-survives-refresh", async () => {
      await page.goto(`${server.base}/learn`);
      await page.getByLabel("想学的方向").fill("学习AI产品判断，先验证一个场景");
      await page.getByLabel("每周可用时间").selectOption("light");
      await page.reload();
      await page.getByLabel("想学的方向").waitFor();
      assert.equal(await page.getByLabel("想学的方向").inputValue(), "学习AI产品判断，先验证一个场景");
    });
    if (!await step("activate", () => intake(page))) return;
    const currentId = (await current()).curriculum.id;
    await step("cancel-late-generation", async () => {
      await page.getByRole("button", { name: "重新说明目标", exact: true }).click();
      await page.getByLabel("想学的方向").fill("改学AI产品评测");
      let release, reached;
      const waiting = new Promise(done => { release = done; });
      const ready = new Promise(done => { reached = done; });
      const matcher = "**/api/learning/intake";
      await page.route(matcher, async route => {
        const response = await route.fetch(); reached(); await waiting;
        await route.fulfill({ response }).catch(() => {}); // 用户中止后页面请求可能已销毁。
      });
      try {
        await page.getByRole("button", { name: "生成学习路线", exact: true }).click();
        await Promise.race([ready, new Promise((_, reject) => setTimeout(() => reject(new Error("生成未到达注入点")), 30000))]);
        await page.getByRole("button", { name: "取消", exact: true }).click();
        release();
        await page.getByText("已停止等待", { exact: false }).waitFor();
        assert.equal((await current()).curriculum.id, currentId);
        assert.equal(await page.getByLabel("想学的方向").inputValue(), "改学AI产品评测");
      } finally { release(); await page.unroute(matcher); }
      await page.goto(`${server.base}/learn`);
      await page.getByRole("button", { name: "保留当前路线", exact: true }).click();
      await page.getByText("已保留当前路线", { exact: false }).waitFor();
    });
    await step("refresh-during-generation", async () => {
      const currentId = (await current()).curriculum.id;
      await page.getByRole("button", { name: "重新说明目标", exact: true }).click();
      await page.getByLabel("想学的方向").fill("刷新恢复测试：学习AI产品评估");
      let release, reached;
      const waiting = new Promise(done => { release = done; });
      const ready = new Promise(done => { reached = done; });
      await page.route("**/api/learning/intake", async route => {
        const response = await route.fetch(); reached(); await waiting;
        await route.fulfill({ response }).catch(() => {});
      });
      try {
        await page.getByRole("button", { name: "生成学习路线", exact: true }).click();
        await Promise.race([ready, new Promise((_, reject) => setTimeout(() => reject(new Error("生成未到达刷新注入点")), 30000))]);
        await page.reload(); release();
        await page.getByRole("button", { name: "保留当前路线", exact: true }).waitFor();
        assert.equal((await current()).curriculum.id, currentId);
        await page.getByRole("button", { name: "保留当前路线", exact: true }).click();
        await page.getByText("已保留当前路线", { exact: false }).waitFor();
      } finally { release(); await page.unroute("**/api/learning/intake"); }
    });
    const openFeedback = async target => {
      await target.getByRole("button", { name: "学习反馈", exact: true }).click();
      const dialog = target.getByRole("dialog", { name: "留下学习反馈" });
      await dialog.getByRole("button", { name: "还不确定", exact: true }).click();
      await dialog.getByLabel("补充一句（可选）").fill("尚不能解释失败时怎样人工确认");
      await dialog.getByLabel("片段状态").selectOption("keep_open");
      return dialog;
    };
    const stale = await context.newPage();
    await stale.goto(`${server.base}/learn`); await stale.getByRole("button", { name: "学习反馈", exact: true }).waitFor();
    const staleDialog = await openFeedback(stale);
    await step("interrupted-before-write", async () => {
      const before = await signalCount();
      const dialog = await openFeedback(page);
      await page.route("**/api/learning/runs/*/feedback", route => route.abort("failed"));
      await dialog.getByRole("button", { name: /保存并查看结果/ }).click();
      await page.locator(".cl-error").waitFor();
      assert.equal(await signalCount(), before);
      assert.equal(await dialog.getByLabel("补充一句（可选）").inputValue(), "尚不能解释失败时怎样人工确认");
      await page.unroute("**/api/learning/runs/*/feedback");
    });
    await step("lost-response-and-double-click", async () => {
      const dialog = page.getByRole("dialog", { name: "留下学习反馈" });
      const before = await signalCount();
      await page.route("**/api/learning/runs/*/feedback", async route => { await route.fetch(); await route.abort("failed"); }, { times: 1 });
      await dialog.getByRole("button", { name: /保存并查看结果/ }).click();
      await page.locator(".cl-error").waitFor();
      assert.equal(await signalCount(), before + 1);
      await dialog.getByRole("button", { name: /保存并查看结果/ }).dblclick();
      await dialog.locator(".cl-summary-change").first().waitFor();
      assert.equal(await signalCount(), before + 1);
      await dialog.getByRole("button", { name: "关闭", exact: true }).click();
    });
    await step("stale-tab-conflict", async () => {
      const before = await signalCount();
      await staleDialog.getByRole("button", { name: /保存并查看结果/ }).click();
      await staleDialog.getByText("这个任务已有更新反馈", { exact: false }).waitFor();
      assert.equal(await signalCount(), before);
      assert.equal((await current()).activities[0].status, "in_progress");
    });
    await stale.close();
    await step("next-week-confirmation", async () => {
      await page.locator(".cl-next-week").getByRole("button", { name: "生成提案", exact: true }).click();
      await page.getByRole("button", { name: "确认下一周", exact: true }).waitFor();
      const before = await current();
      assert.ok(before.nextWeekProposal);
      const plans = await server.inspectDatabase("SELECT status FROM learning_weekly_plans WHERE owner_id=? AND week_key=?", [owner, before.nextWeekProposal.weekKey]);
      assert.equal(plans[0].status, "draft");
      await page.getByRole("button", { name: "确认下一周", exact: true }).click();
      await page.getByRole("button", { name: "确认下一周", exact: true }).waitFor({ state: "hidden" });
      assert.equal((await server.inspectDatabase("SELECT status FROM learning_weekly_plans WHERE owner_id=? AND week_key=?", [owner, before.nextWeekProposal.weekKey]))[0].status, "confirmed");
    });
  });
  await scenario("limited-route", async ({ page, current, step }) => {
    const goal = "只使用DeepLearning.AI学习AI产品评测、失败风险与可观测性，没有编程基础";
    if (!await step("review-impact-and-preserve-input", async () => {
      await page.goto(`${server.base}/learn`);
      await page.getByLabel("想学的方向").fill(goal);
      await page.getByLabel("每周可用时间").selectOption("light");
      await page.getByRole("button", { name: "生成学习路线", exact: true }).click();
      await page.getByRole("heading", { name: "先核对未覆盖的目标", exact: true }).waitFor({ timeout: 60000 });
      await page.getByRole("button", { name: "先开始已覆盖的部分", exact: true }).waitFor();
      const coverage = page.getByRole("region", { name: "路线覆盖与下一步" });
      assert.ok((await coverage.innerText()).includes("尚未安排"));
      assert.ok(!/\b(?:pm|app|ai)\.[a-z-]+/.test(await coverage.innerText()));
      await coverage.getByRole("button", { name: "补充材料或修改目标", exact: true }).click();
      assert.equal(await page.getByLabel("想学的方向").inputValue(), goal);
      assert.equal(await page.getByLabel("每周可用时间").inputValue(), "light");
      await page.getByRole("button", { name: "取消", exact: true }).click();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: resolve(run.directory, "limited-route-mobile.png"), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    })) return;
    await step("adopt-partial-and-restore-limit", async () => {
      await page.getByRole("button", { name: "先开始已覆盖的部分", exact: true }).click();
      await page.getByRole("heading", { name: "当前执行的是部分路线", exact: true }).waitFor();
      const before = await current();
      assert.ok(before.activities.length > 0);
      await page.reload();
      await page.getByRole("heading", { name: "当前执行的是部分路线", exact: true }).waitFor();
      assert.equal((await current()).curriculum.id, before.curriculum.id);
    });
  });
} catch (error) {
  run.report.checks.push({ id: "environment", status: "failed", error: error.message });
} finally {
  await browser?.close(); await server?.stop();
  await writeFile(resolve(run.directory, "requests.json"), JSON.stringify(requests, null, 2));
  run.report.pending = ["真人5分钟理解与10分钟启动", "隔日恢复与三次任务两种活动", "完整阶段能力出口评审", "真实登录"];
  run.report.status = "completed";
  await run.save();
  console.log(`浏览器证据：${run.directory}`);
  process.exitCode = run.report.automatedPassed ? 2 : 1;
}
