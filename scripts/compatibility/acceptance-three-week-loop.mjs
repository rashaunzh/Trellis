// Trellis daily usable 3-week loop acceptance.
// Run with dev server active:
//   npm run acceptance:three-week-loop
import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
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

mkdirSync(resolve("outputs/acceptance"), { recursive: true });

const OWNER_ID = "three-week-loop-owner";
const SHOT_LEARN = resolve("outputs/acceptance/acceptance-three-week-learn.png");
const SHOT_REVIEW = resolve("outputs/acceptance/acceptance-three-week-review-history.png");
const SHOT_ARTIFACT = resolve("outputs/acceptance/acceptance-three-week-artifact-loop.png");

const post = (path, body = {}) => apiPost(path, body, OWNER_ID);

async function get(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "x-trellis-owner-id": OWNER_ID },
  });
  if (!response.ok) throw new Error(`${path} -> ${response.status}: ${await response.text()}`);
  return response.json();
}

function firstExecutableActivity(workspace) {
  const activity = workspace.activities.find((item) => item.status !== "completed");
  if (!activity) throw new Error("no executable activity found");
  return activity;
}

async function submitAndReview(activity, content, evidenceType = "text", weekKey) {
  let workspace = activity.status === "planned"
    ? (await post(`/api/learning/activities/${activity.id}/start`)).workspace
    : (await get("/api/learning/workspace")).workspace;
  workspace = (await post(`/api/learning/activities/${activity.id}/evidence`, {
    evidenceType,
    content,
  })).workspace;
  if (weekKey) workspace = (await get(`/api/learning/workspace?weekKey=${weekKey}`)).workspace;
  const evidence = workspace.evidence
    .filter((item) => item.activityId === activity.id)
    .at(-1);
  if (!evidence) throw new Error(`evidence not found for ${activity.id}`);
  workspace = (await post(`/api/learning/evidence/${evidence.id}/review`)).workspace;
  if (weekKey) workspace = (await get(`/api/learning/workspace?weekKey=${weekKey}`)).workspace;
  const reviewed = workspace.evidence.find((item) => item.id === evidence.id);
  if (!reviewed) throw new Error(`reviewed evidence not found for ${evidence.id}`);
  return { workspace, reviewed };
}

async function prepareThreeWeekState() {
  await post("/api/learning/reset");
  let workspace = (await post("/api/learning/diagnostic", {
    goal: "我想把 AI Agent 产品能力训练成一个能真实迭代的作品集项目",
    weeklyMinutes: 240,
    materialIds: ["res.openai-evals"],
    preference: "build_first",
    plannerMode: "adaptive_existing_content",
  })).workspace;
  workspace = (await post("/api/learning/proposal/confirm")).workspace;
  const week1 = workspace.weeklyPlan.weekKey;
  const activity1 = firstExecutableActivity(workspace);

  const inbox = await post("/api/learning/resources/inbox", {
    title: "Agent PRD 评审笔记",
    type: "note",
    content: "用于补充 AI Agent 产品 PRD 的用户场景、评测指标和失败标准。",
    relatedNodeIds: [activity1.nodeId],
  });
  const resource = inbox.resources.at(-1);
  workspace = (await get(`/api/learning/workspace?weekKey=${week1}`)).workspace;
  const activityWithResource = workspace.activities.find((item) => item.id === activity1.id);
  check("mapped user resource enters current activity", activityWithResource?.inputRefs.includes(resource.id));

  let result = await submitAndReview(activity1, "我看了材料，感觉有点懂。", "text", week1);
  check("short evidence needs revision", result.reviewed.status === "needs_revision", result.reviewed.status);

  const activity1Revision = result.workspace.activities.find((item) => item.id === activity1.id) ?? activity1;
  result = await submitAndReview(
    activity1Revision,
    "修订证据 v2：我能说明这个节点的核心问题、适用场景、输入输出、评估标准和失败边界。" +
      " 我把它应用到 AI Agent PRD 作品中：用户是一位转型 AI PM，任务是在三周内完成可评审作品。" +
      " 成功标准包括问题定义清楚、能力边界可解释、评测指标可复核、人工兜底明确。" +
      " 我也说明了如果证据只来自主观感觉，就不能进入掌握确认。",
    "text",
    week1,
  );
  check("revised evidence accepted", result.reviewed.status === "accepted", result.reviewed.status);

  workspace = (await post("/api/learning/week-review", { weekKey: week1, generateNextWeek: false })).workspace;
  check("week 1 review archived", Boolean(workspace.weekReview?.archivedAt));
  workspace = (await post("/api/learning/week-review", { weekKey: week1 })).workspace;
  const week2 = workspace.weeklyPlan.weekKey;
  check("week 2 generated", week2 !== week1, week2);

  const week1Again = (await get(`/api/learning/workspace?weekKey=${week1}`)).workspace;
  check("week 1 evidence preserved after week 2", week1Again.evidence.some((item) => item.status === "accepted"));
  check("week history has two weeks", week1Again.weeklyPlanHistory.length >= 2);

  const week2Activity = firstExecutableActivity(workspace);
  result = await submitAndReview(
    week2Activity,
    "第 2 周证据：我基于上周复盘继续推进，明确了本周活动为什么做、预期证据、下一步动作和风险。" +
      " 对同一作品链，我能把 rubric 缺口转成修订行动，并记录材料是否适配当前节点。" +
      " 具体到 AI Agent PRD：我补全了用户场景、核心能力、输入输出、边界条件、人工兜底、评测指标和失败标准。" +
      " 我把材料映射到当前节点，说明哪些内容支持问题定义，哪些内容只适合作为参考，哪些内容不能直接作为掌握证据。" +
      " 我用一个失败样例验证了规则：只有 accepted hard evidence 才能推动掌握确认，needs_revision 只能生成修订建议。" +
      " 最终产出包括修订后的作品片段、rubric 对照表、下一步行动和可复核来源说明。",
    "text",
    week2,
  );
  check("week 2 hard evidence accepted", result.reviewed.status === "accepted", result.reviewed.status);
  workspace = (await post("/api/learning/week-review", { weekKey: week2 })).workspace;
  const week3 = workspace.weeklyPlan.weekKey;
  check("week 3 generated", week3 !== week2, week3);

  const week3Workspace = (await get(`/api/learning/workspace?weekKey=${week3}`)).workspace;
  check("week history has three weeks", week3Workspace.weeklyPlanHistory.length >= 3);
  check("week 3 reads independently", week3Workspace.weeklyPlan.weekKey === week3);
  check("user resource still visible", week3Workspace.userResources.some((item) => item.id === resource.id));
  return { week1, week2, week3 };
}

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

async function waitForBody(send, expectText, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const poll = await send("Runtime.evaluate", {
      expression: "document.readyState + '::' + document.body.innerText",
      returnByValue: true,
    });
    const body = String(poll.result.value ?? "").split("::").slice(1).join("::");
    if (body.length > 100 && !body.includes("正在准备你的学习环境") && body.includes(expectText)) {
      return body;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error(`page body did not contain "${expectText}"`);
}

async function screenshot(send, file) {
  const image = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  writeFileSync(file, Buffer.from(image.data, "base64"));
  check(`screenshot saved ${file}`, statSync(file).size > 10000);
}

async function verifyBrowser(week2, week3) {
  const { chrome, cdp, send } = await launchBrowser();
  try {
    await send("Page.navigate", { url: `${BASE}/learn` });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 800));
    await send("Runtime.evaluate", {
      expression: `localStorage.setItem('trellis.anonymousOwnerId', '${OWNER_ID}')`,
      returnByValue: true,
    });
    await send("Page.navigate", { url: `${BASE}/learn` });
    const body = await waitForBody(send, "计划历史");
    check("learn page renders focus triad", body.includes("本次行动") && body.includes("本周只看") && body.includes("待处理"));
    check("learn page renders week history", body.includes(week2) && body.includes(week3));
    check("learn page renders week review", body.includes("周复盘"));
    check("learn page renders course slicer", body.includes("课程切片") && body.includes("本周只看"));
    check("learn page renders artifact loop", body.includes("阶段作品闭环"));
    check("system panel collapsed", body.includes("系统状态"));
    await send("Runtime.evaluate", {
      expression: "document.querySelector('.t2-focus-main button')?.click()",
      returnByValue: true,
    });
    const drawerBody = await waitForBody(send, "先做这一小段");
    check("drawer prioritizes action slice", drawerBody.includes("先做这一小段") && drawerBody.includes("轻反馈"));
    await send("Runtime.evaluate", {
      expression: "document.querySelector('.t2-close')?.click()",
      returnByValue: true,
    });
    await screenshot(send, SHOT_LEARN);

    await send("Runtime.evaluate", {
      expression: "document.querySelector('.t2-week-history')?.scrollIntoView({ block: 'start' })",
      returnByValue: true,
    });
    await screenshot(send, SHOT_REVIEW);
    await send("Runtime.evaluate", {
      expression: "document.querySelector('.t2-artifact-loop')?.scrollIntoView({ block: 'start' })",
      returnByValue: true,
    });
    await screenshot(send, SHOT_ARTIFACT);

    const overlay = await send("Runtime.evaluate", {
      expression: "document.querySelector('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay') ? 'ERROR_OVERLAY' : 'OK'",
      returnByValue: true,
    });
    check("no framework error overlay", overlay.result.value === "OK", overlay.result.value);
    check("no browser exceptions", !cdp.events.some((event) => event.method === "Runtime.exceptionThrown"));
    cdp.close();
  } finally {
    chrome.kill();
  }
}

const state = await prepareThreeWeekState();
await verifyBrowser(state.week2, state.week3);
if (process.exitCode) process.exit(process.exitCode);
console.log(`SHOTS ${SHOT_LEARN} ${SHOT_REVIEW} ${SHOT_ARTIFACT}`);
