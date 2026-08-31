// Trellis portfolio full-loop browser acceptance via Chrome DevTools Protocol.
// 作品级主链路：reset → diagnostic（页面表单）→ StagePath/DynamicSimulation → confirm
// → artifact → evidence → review → mastery → next stage → /learn 渲染 → quality/eval。
// 无 npm 依赖；复用 scripts/lib/browser-cdp.mjs 的 CDP/API helpers。
// Run with dev server active:
//   node scripts/compatibility/acceptance-portfolio-full-loop.mjs
import { statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { rmSync, mkdirSync } from "node:fs";
import {
  BASE,
  PORT,
  USER_DATA_DIR,
  check,
  apiPost,
  findChrome,
  waitForJsonVersion,
  waitForPageTarget,
  connectCdp,
} from "../lib/browser-cdp.mjs";

const OWNER_ID = "portfolio-full-loop-owner";
const SHOT_ONBOARDING = resolve("docs/acceptance-portfolio-onboarding.png");
const SHOT_STAGE = resolve("docs/acceptance-portfolio-stage-path.png");
const SHOT_NEXT = resolve("docs/acceptance-portfolio-next-stage.png");

const GOAL = "我是转 AI PM 的小白，希望完成一个 AI Agent 产品 PRD 作品集项目";

// 与 acceptance-next-stage-rubric.mjs 同源的已验收作品证据（hard evidence，评审 accepted）
const ARTIFACT_EVIDENCE =
  "AI Agent 产品 PRD v1：用户场景描述是一位 AI PM 转型小白在三周内需要完成可评审作品，问题陈述拆解为目标模糊、资料错配、时间容量变化和证据不足。成功标准定义为能输出 PRD、案例拆解和评测方案，并被第三方复核。方案与需求区分清楚，价值假设说明完整。能力清单拆解包括处境识别、资料评估、阶段路径、动态调整和证据评审。输入输出定义包括学习目标、资料、时间精力信号、行为信号、作品证据，输出 next best move、active risks、stage path 和调整记录。可评测标准包括计划完成率、证据通过率、资料错配次数和评审置信度。能力边界说明 soft signal 只影响下一步决策，不能直接 validated。人工兜底设计包括主路径变化、作品方向确认和掌握确认。评测结果引用 eval suite 的 situation、material fit、stage path、dynamic adjustment、artifact loop。上线回滚判断依据失败标准，用户感知指标和系统指标区分明确，产品改进建议是补齐下一阶段讲述。";

async function apiGet(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "x-trellis-owner-id": OWNER_ID },
  });
  if (!response.ok) throw new Error(`${path} -> ${response.status}: ${await response.text()}`);
  return response.json();
}

// apiPost 由 next-stage 导入，其默认 owner 是 next-stage 的；这里固定传本脚本 owner，
// 保证 API 状态与浏览器（localStorage 同 owner）落在同一个学习状态上。
const post = (path, body = {}) => apiPost(path, body, OWNER_ID);

// ── 浏览器驱动（复用 next-stage 的 CDP helpers）────────
async function launchBrowser() {
  const chromePath = findChrome();
  if (!chromePath) throw new Error("Chrome or Edge executable not found");
  rmSync(USER_DATA_DIR, { recursive: true, force: true });
  mkdirSync(USER_DATA_DIR, { recursive: true });
  const chrome = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    "--disable-gpu",
    "--disable-gpu-compositing",
    "--disable-software-rasterizer",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ], { stdio: "ignore" });
  try {
    await waitForJsonVersion();
    const target = await waitForPageTarget();
    const cdp = connectCdp(target.webSocketDebuggerUrl);
    await cdp.ready;
    const send = (method, params = {}) => cdp.send(method, params);
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    return { chrome, cdp, send };
  } catch (error) {
    chrome.kill();
    throw error;
  }
}

async function navigateWithOwner(send) {
  await send("Page.navigate", { url: `${BASE}/learn` });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 800));
  await send("Runtime.evaluate", {
    expression: `localStorage.setItem('trellis.anonymousOwnerId', '${OWNER_ID}')`,
    returnByValue: true,
  });
  await send("Page.navigate", { url: `${BASE}/learn` });
}

async function waitForBody(send, expectText, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const poll = await send("Runtime.evaluate", {
      expression: "document.readyState + '::' + document.body.innerText",
      returnByValue: true,
    });
    const readyAndBody = poll.result.value ?? "";
    const body = readyAndBody.split("::").slice(1).join("::");
    if (body.length > 100 && !body.includes("正在准备你的学习环境") && body.includes(expectText)) {
      return body;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error(`page body did not contain "${expectText}" within ${timeoutMs}ms`);
}

async function clickButtonAndWait(send, label, expectText, timeoutMs = 20000) {
  await send("Runtime.evaluate", {
    expression: `(() => {
      const button = Array.from(document.querySelectorAll('button'))
        .find((b) => b.textContent.includes(${JSON.stringify(label)}));
      if (!button) return 'NO_BUTTON';
      button.click();
      return 'CLICKED';
    })()`,
    returnByValue: true,
  });
  const body = await waitForBody(send, expectText, timeoutMs);
  check(`${label} 渲染 ${expectText}`, true);
  return body;
}

async function captureFullPage(send, shotPath) {
  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  writeFileSync(shotPath, Buffer.from(screenshot.data, "base64"));
  check("screenshot saved", statSync(shotPath).size > 10000, shotPath);
}

// ── Pass 1：页面表单诊断 → 提案视图（StagePath / DynamicSimulation）→ 截图 ──
async function verifyStagePathView() {
  const { chrome, cdp, send } = await launchBrowser();
  try {
    await navigateWithOwner(send);
    const onboarding = await waitForBody(send, "识别学习处境并生成阶段路径", 15000);
    check("onboarding view renders", onboarding.includes("识别学习处境并生成阶段路径"));
    check("onboarding journey renders", onboarding.includes("作品方向") && onboarding.includes("资料适配"));
    await captureFullPage(send, SHOT_ONBOARDING);

    // React 受控表单：原生 value setter + 事件（时间保持默认 5 小时；偏好 build_first；勾选 Evals 资料）
    await send("Runtime.evaluate", {
      expression: `(() => {
        const el = document.querySelector('textarea');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(el, ${JSON.stringify(GOAL)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return el.value;
      })()`,
      returnByValue: true,
    });
    await send("Runtime.evaluate", {
      expression: `(() => {
        const select = document.querySelectorAll('select')[1];
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
        setter.call(select, 'build_first');
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return select.value;
      })()`,
      returnByValue: true,
    });
    await send("Runtime.evaluate", {
      expression: `(() => {
        const boxes = document.querySelectorAll('.t2-material-picker input[type="checkbox"]');
        const target = Array.from(boxes).find((box) => box.closest('label').innerText.includes('Evals'));
        if (!target) return 'NO_CHECKBOX';
        if (!target.checked) target.click();
        return target.checked ? 'CHECKED' : 'UNCHECKED';
      })()`,
      returnByValue: true,
    });
    await send("Runtime.evaluate", {
      expression: `(() => {
        const button = Array.from(document.querySelectorAll('button'))
          .find((b) => b.textContent.includes('识别学习处境并生成阶段路径'));
        if (!button) return 'NO_BUTTON';
        button.click();
        return 'CLICKED';
      })()`,
      returnByValue: true,
    });

    const proposal = await waitForBody(send, "先判断处境，再确认阶段路径", 20000);
    check("proposal view renders", proposal.includes("先判断处境，再确认阶段路径"));
    check("proposal journey renders", proposal.includes("Situation") && proposal.includes("Material Fit") && proposal.includes("Stage Path") && proposal.includes("Simulation"));
    check("stage path panel renders", proposal.includes("完整阶段路径"));
    check("dynamic simulation panel renders", proposal.includes("前三周动态演示"));
    check("no browser exceptions (stage view)", !cdp.events.some((e) => e.method === "Runtime.exceptionThrown"));

    await send("Runtime.evaluate", {
      expression: "document.querySelector('.t2-stage-panel')?.scrollIntoView({ block: 'start' })",
      returnByValue: true,
    });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
    await captureFullPage(send, SHOT_STAGE);
  } finally {
    cdp.close();
    chrome.kill();
  }
}

// ── API：confirm → artifact → evidence → review → mastery → next stage ──
async function prepareFullLoop() {
  await post("/api/learning/proposal/confirm");
  let workspace = (await post("/api/learning/artifact")).workspace;
  const artifact = workspace.activities.find((activity) => activity.title.includes("AI Agent 产品 PRD"));
  if (!artifact) throw new Error("portfolio artifact activity not found");

  await post(`/api/learning/activities/${artifact.id}/start`);
  workspace = (await post(`/api/learning/activities/${artifact.id}/evidence`, {
    evidenceType: "artifact",
    content: ARTIFACT_EVIDENCE,
  })).workspace;
  const evidence = workspace.evidence.find((item) => item.activityId === artifact.id);
  if (!evidence) throw new Error("portfolio evidence not found");

  workspace = (await post(`/api/learning/evidence/${evidence.id}/review`)).workspace;
  workspace = (await post(`/api/learning/nodes/${artifact.nodeId}/confirm-mastery`, {
    decision: "confirmed",
  })).workspace;
  const adjustment = workspace.adjustments.find((item) =>
    item.adjustmentType === "route_revision" && item.status === "proposed"
  );
  if (!adjustment) throw new Error("next stage adjustment not found");
  workspace = (await post(`/api/learning/adjustments/${adjustment.id}/confirm`)).workspace;

  check("next stage plan exists", Boolean(workspace.nextStagePlan));
  check(
    "formal next-stage activities generated",
    workspace.activities.filter((activity) => activity.title.startsWith("下一阶段：")).length === 3,
  );
}

// ── API：quality / eval / mastra-runtime（StagePath/DynamicSimulation）──
async function verifyQualityAndEval() {
  const { artifactIteration } = await apiGet("/api/learning/artifact");
  check(
    "artifact api: iteration state readable",
    ["packaging_in_progress", "next_stage_proposed", "mastery_confirmation_needed"].includes(artifactIteration.status),
    `status=${artifactIteration.status}`,
  );
  check(
    "artifact api: version history readable",
    Array.isArray(artifactIteration.versions) && artifactIteration.versions.length >= 1,
    `versions=${artifactIteration.versions?.length}`,
  );
  check(
    "artifact api: revision count readable",
    Number.isInteger(artifactIteration.revisionCount) && artifactIteration.revisionCount >= 0,
    `revisionCount=${artifactIteration.revisionCount}`,
  );

  const { quality } = await apiGet("/api/learning/quality");
  check("quality: artifact task exists", quality.artifactTaskExists === true);
  check("quality: artifact evidence accepted", quality.artifactEvidenceStatus === "accepted");
  check("quality: next stage plan exists", quality.nextStagePlanExists === true);
  check("quality: tool registry ready", quality.toolRegistryReady === true);
  // 该 demo 目标派生关键词（ai/pm/agent/prd）命中率低于 0.5 → generic fallback，
  // 正是 runbook 声称的 "fallbackMode = rule"（无 API key 规则降级的生产叙事）。
  check("quality: rule fallback mode", quality.fallbackMode === true, `fallbackMode=${quality.fallbackMode}`);

  const { report: evalReport } = await post("/api/learning/eval");
  check("eval endpoint pass rate 1", evalReport.passRate === 1, `${evalReport.passed}/${evalReport.total} pass`);

  const { runtime } = await apiGet("/api/learning/mastra-runtime");
  check("mastra runtime registered", runtime.registered === true);
  check("mastra runtime studio scripts configured", runtime.cliScriptConfigured === true && runtime.studioScriptConfigured === true);

  const { report: runtimeReport } = await post("/api/learning/mastra-runtime");
  check(
    "mastra runtime stage path exists",
    Boolean(runtimeReport.stagePath) && runtimeReport.stagePath.durationWeeks >= 6,
    `durationWeeks=${runtimeReport.stagePath?.durationWeeks}`,
  );
  check(
    "mastra runtime dynamic simulation exists",
    Boolean(runtimeReport.dynamicSimulation) && runtimeReport.dynamicSimulation.adjustments.length >= 4,
    `adjustments=${runtimeReport.dynamicSimulation?.adjustments?.length}`,
  );
  check(
    "mastra runtime workflow trace >= 10 steps",
    Array.isArray(runtimeReport.workflowTrace) && runtimeReport.workflowTrace.length >= 10,
    `steps=${runtimeReport.workflowTrace?.length}`,
  );
  check(
    "mastra runtime step outputs readable",
    Array.isArray(runtimeReport.stepOutputs) && runtimeReport.stepOutputs.length === runtimeReport.workflowTrace.length,
    `stepOutputs=${runtimeReport.stepOutputs?.length}`,
  );
  check(
    "mastra runtime hitl checkpoints readable",
    Array.isArray(runtimeReport.hitlCheckpoints) && runtimeReport.hitlCheckpoints.length >= 4,
    `hitlCheckpoints=${runtimeReport.hitlCheckpoints?.length}`,
  );
  check(
    "mastra runtime resume contract readable",
    runtimeReport.resumeContract?.canResumeViaApi === true,
    `canResumeViaApi=${runtimeReport.resumeContract?.canResumeViaApi}`,
  );
  check(
    "mastra runtime readiness readable",
    runtimeReport.runtimeReadiness?.executable === true && runtimeReport.runtimeReadiness?.observable === true,
    `readiness=${JSON.stringify(runtimeReport.runtimeReadiness)}`,
  );
}

// ── Pass 2：确认视图 → NextStagePlan / 正式活动 / rubric / quality / eval → 截图 ──
async function verifyNextStageView() {
  const { chrome, cdp, send } = await launchBrowser();
  try {
    await navigateWithOwner(send);
    const body = await waitForBody(send, "已生成 3 个正式活动", 20000);
    check("page renders content", body.length > 100);
    check("page renders Next Stage panel", body.includes("AI PM 作品集包装阶段"));
    check("formal activity count visible", body.includes("已生成 3 个正式活动"));
    check("rubric visible: Learning Situation-first", body.includes("Learning Situation-first"));
    check("rubric visible: runtime fallback", body.includes("runtime fallback"));
    check("rubric visible: 10-15 分钟", body.includes("10-15 分钟"));
    check(
      "artifact iteration visible",
      body.includes("阶段作品闭环") && /作品包装中|下一阶段待采纳|等待掌握确认|等待 v1 证据|需要修订/.test(body),
    );
    check("artifact revision count visible", body.includes("修订轮次") || body.includes("修订 0 次"));
    check("artifact version history visible", body.includes("v1"));
    check("quality panel visible", body.includes("作品级质量面板") && body.includes("计划完成率"));
    check("action card evidence/status visible", body.includes("证据要求") && body.includes("行动状态") && body.includes("证据状态"));

    await clickButtonAndWait(send, "运行 eval", "100% pass");
    await clickButtonAndWait(send, "运行 Mastra runtime", "API resume contract");

    const overlayResult = await send("Runtime.evaluate", {
      expression: "document.querySelector('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay') ? 'ERROR_OVERLAY' : 'OK'",
      returnByValue: true,
    });
    check("no framework error overlay", overlayResult.result.value === "OK", overlayResult.result.value);
    check("no browser exceptions (next stage view)", !cdp.events.some((e) => e.method === "Runtime.exceptionThrown"));

    await send("Runtime.evaluate", {
      expression: "document.querySelector('.t2-next-stage-plan')?.scrollIntoView({ block: 'start' })",
      returnByValue: true,
    });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
    await captureFullPage(send, SHOT_NEXT);
  } finally {
    cdp.close();
    chrome.kill();
  }
}

await post("/api/learning/reset");
await verifyStagePathView();
await prepareFullLoop();
await verifyQualityAndEval();
await verifyNextStageView();
if (process.exitCode) process.exit(process.exitCode);
console.log(`SHOT ${SHOT_ONBOARDING}`);
console.log(`SHOT ${SHOT_STAGE}`);
console.log(`SHOT ${SHOT_NEXT}`);
