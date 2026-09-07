// Trellis internal-test acceptance.
// Run with the dev server active:
//   TRELLIS_BASE=http://127.0.0.1:5177 npm run acceptance:internal-test-loop
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

const OWNER_ID = "internal-test-loop-owner";
const SHOTS = {
  firstUse: resolve("docs/acceptance-internal-test-first-use.png"),
  resume: resolve("docs/acceptance-internal-test-resume.png"),
  workbench: resolve("docs/acceptance-internal-test-workbench.png"),
  mobile: resolve("docs/acceptance-internal-test-mobile.png"),
};

const post = (path, body = {}) => apiPost(path, body, OWNER_ID);

async function get(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "x-trellis-owner-id": OWNER_ID, "Connection": "close" },
  });
  if (!response.ok) throw new Error(`${path} -> ${response.status}: ${await response.text()}`);
  return response.json();
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
      height: 1050,
      deviceScaleFactor: 1,
      mobile: false,
    });
    return { chrome, cdp, send };
  } catch (error) {
    chrome.kill();
    throw error;
  }
}

async function waitForBody(send, expected, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastBody = "";
  while (Date.now() < deadline) {
    const result = await send("Runtime.evaluate", {
      expression: "document.readyState + '::' + document.body.innerText",
      returnByValue: true,
    });
    const body = String(result.result.value ?? "").split("::").slice(1).join("::");
    lastBody = body;
    if (body.length > 100 && body.includes(expected)) return body;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error(`page body did not contain "${expected}"; body=${lastBody.slice(0, 1200)}`);
}

async function navigate(send, path, expected) {
  await send("Page.navigate", { url: `${BASE}${path}` });
  return waitForBody(send, expected);
}

async function screenshot(send, file) {
  const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(file, Buffer.from(result.data, "base64"));
  check(`screenshot saved ${file}`, statSync(file).size > 10000);
}

async function verifyNoRuntimeError(send) {
  const result = await send("Runtime.evaluate", {
    expression: "document.body.innerText.includes('Runtime Error') || document.body.innerText.includes('Unhandled Runtime Error')",
    returnByValue: true,
  });
  check("no framework runtime error", result.result.value === false);
}

async function prepareRoute() {
  await post("/api/learning/reset");
  const { curriculum } = await post("/api/learning/intake", {
    goal: "我想判断 Agent 产品场景，设计能力边界、人工兜底和最小评测方案",
    weeklyCapacity: "steady",
    materials: [{ url: "https://www.deeplearning.ai/courses/" }],
  });
  const active = curriculum.assembly.decisions.filter((item) =>
    ["anchor", "selected_units", "supplement"].includes(item.role),
  );
  check("scenario 1 finite route", active.length > 0 && active.length <= 3, String(active.length));
  check("scenario 1 explicit gaps", curriculum.assembly.unresolvedGaps.length > 0);
  check("scenario 1 no ML default prerequisite", !active.some((item) => item.courseId === "dlai.ml-specialization"));
  return curriculum;
}

async function runProductStateChecks(curriculum) {
  await post(`/api/learning/curricula/${curriculum.id}/confirm`);
  let { current } = await get("/api/learning/current");
  const activity = current.activities[0];
  check("scenario 2 has current activity", Boolean(activity?.id && activity?.unitId && activity?.canonicalNodeId));
  check("scenario 2 source honesty", ["exact", "course_root", "missing"].includes(current.sourceResolution.kind));
  check("scenario 2 route management summary", current.routeManagementSummary.adoptedCount > 0);

  await post(`/api/learning/runs/${activity.id}/start`);
  ({ current } = await get("/api/learning/current"));
  check("scenario 3 opened without feedback", current.resumeState.mode === "opened_without_feedback");
  check("scenario 3 next action is explicit", current.resumeState.nextActionLabel === "继续并补反馈");
  await post(`/api/learning/runs/${activity.id}/pause`, { reason: "内测：被会议打断" });
  ({ current } = await get("/api/learning/current"));
  check("scenario 3 pause reason survives", current.resumeState.mode === "paused" && current.resumeState.reason.includes("会议"));

  await fetch(`${BASE}/api/learning/runs/${activity.id}/location`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-trellis-owner-id": OWNER_ID },
    body: JSON.stringify({
      sourceUrl: "https://www.deeplearning.ai/courses/",
      locatorLabel: "DeepLearning.AI catalog · selected Agent unit",
    }),
  });
  ({ current } = await get("/api/learning/current"));
  check("scenario 2 personal source override", current.sourceResolution.kind === "exact" && current.sourceResolution.manualOverride === true);

  await post(`/api/learning/runs/${activity.id}/feedback`, {
    type: "quiz_result",
    value: 88,
    note: "课程原测试通过，能解释 Agent 产品边界",
    actualMinutes: 40,
    completionIntent: "complete",
  });
  ({ current } = await get("/api/learning/current"));
  check("scenario 4 adaptation persisted", current.adaptationTimeline.length > 0 && current.adaptationTimeline[0].signalSummary.includes("课程原测验"));
  check("scenario 4 actual minutes persisted", current.activities[0].actualMinutes === 40);

  const nextActivity = current.activities.find((item) => item.status !== "completed") ?? current.activities[0];
  const { resources } = await post("/api/learning/resources/inbox", {
    type: "link",
    title: "内测补充材料：Agent 评估案例",
    content: "用于当前片段的评估样例，不改变主路线。",
    sourceUrl: "https://example.com/agent-eval-case",
    relatedNodeIds: nextActivity.scope?.nodeIds ?? [],
  });
  const resource = resources.find((item) => item.title === "内测补充材料：Agent 评估案例");
  await post(`/api/learning/resources/${resource.id}/attachments`, { activityId: nextActivity.id });
  ({ current } = await get("/api/learning/current"));
  check("scenario 5 workbench attachment", current.attachedResources.some((item) => item.id === resource.id));
}

async function runBrowserChecks() {
  const { chrome, cdp, send } = await launchBrowser();
  try {
    await send("Page.navigate", { url: `${BASE}/learn` });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));
    await send("Runtime.evaluate", {
      expression: `localStorage.setItem('trellis.anonymousOwnerId', '${OWNER_ID}')`,
      returnByValue: true,
    });

    let body = await navigate(send, "/learn", "当前片段");
    check("scenario 1/2 learn page is understandable", body.includes("路线管理") && body.includes("来源定位") && body.includes("当前片段"));
    await screenshot(send, SHOTS.firstUse);
    await verifyNoRuntimeError(send);

    body = await navigate(send, "/learn", "最近变化");
    check("scenario 3/4 resume and adaptation visible", body.includes("继续") && body.includes("最近变化") && body.includes("课程原测验"));
    await screenshot(send, SHOTS.resume);

    body = await navigate(send, "/workbench", "内测补充材料");
    check("scenario 5 workbench context visible", body.includes("已附加当前片段") || body.includes("已关联当前节点"));
    await screenshot(send, SHOTS.workbench);
    await verifyNoRuntimeError(send);

    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    body = await navigate(send, "/learn", "当前片段");
    const overflow = await send("Runtime.evaluate", {
      expression: "document.documentElement.scrollWidth > window.innerWidth + 2",
      returnByValue: true,
    });
    check("mobile keeps internal test flow usable", body.includes("学习反馈") && body.includes("工作台") && overflow.result.value === false);
    await screenshot(send, SHOTS.mobile);
    await verifyNoRuntimeError(send);
  } finally {
    cdp.close();
    chrome.kill();
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
    try {
      rmSync(USER_DATA_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    } catch {
      // Chrome can retain Windows profile handles briefly after process exit.
    }
  }
}

try {
  const curriculum = await prepareRoute();
  await runProductStateChecks(curriculum);
  await runBrowserChecks();
  if (process.exitCode) throw new Error("internal-test-loop acceptance failed");
  console.log("PASS internal-test-loop");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
