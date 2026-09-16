// Trellis course-intelligence vertical-slice acceptance via API and Chrome CDP.
// Run with the dev server active:
//   TRELLIS_BASE=http://127.0.0.1:5177 npm run acceptance:course-intelligence
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

const OWNER_ID = "course-intelligence-acceptance-owner";
const SHOTS = {
  proposal: resolve("outputs/acceptance/acceptance-continuous-learning-proposal.png"),
  learn: resolve("outputs/acceptance/acceptance-continuous-learning-learn.png"),
  feedback: resolve("outputs/acceptance/acceptance-continuous-learning-feedback.png"),
  grow: resolve("outputs/acceptance/acceptance-continuous-learning-grow.png"),
  workbench: resolve("outputs/acceptance/acceptance-continuous-learning-workbench.png"),
  mobile: resolve("outputs/acceptance/acceptance-continuous-learning-mobile.png"),
};

const post = (path, body = {}) => apiPost(path, body, OWNER_ID);

async function get(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "x-trellis-owner-id": OWNER_ID, "Connection": "close" },
  });
  if (!response.ok) throw new Error(`${path} -> ${response.status}: ${await response.text()}`);
  return response.json();
}

async function prepareState() {
  await post("/api/learning/reset");
  const { state } = await get("/api/learning/intelligence/state");
  check("published catalog is available", state.catalogCount >= 25, String(state.catalogCount));
  check("published domain graph is substantial", state.graph.nodes.length >= 30, String(state.graph.nodes.length));

  const { curriculum } = await post("/api/learning/intake", {
    goal: "我想判断 Agent 产品场景，设计能力边界、人工兜底和最小评测方案",
    weeklyCapacity: "steady",
    materials: [{ url: "https://www.deeplearning.ai/courses/" }],
  });
  const active = curriculum.assembly.decisions.filter((item) =>
    ["anchor", "selected_units", "supplement"].includes(item.role),
  );
  check("one course is the stage anchor", active.filter((item) => item.role === "anchor").length === 1);
  check("curriculum remains finite", active.length > 0 && active.length < 8, String(active.length));
  check(
    "ML specialization is not an AI PM prerequisite",
    !active.some((item) => item.courseId === "dlai.ml-specialization"),
  );
  check("DeepLearning.AI catalog remains the decision scope", active.every((item) => item.courseId.startsWith("dlai.")));
  check("first stage points to exact units", curriculum.assembly.stages[0].unitRefs.length > 0);
  check("coverage gaps stay visible", curriculum.assembly.unresolvedGaps.length > 0);
  return curriculum;
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
  const result = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
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

async function verifyBrowser(curriculum) {
  const { chrome, cdp, send } = await launchBrowser();
  try {
    await send("Page.navigate", { url: `${BASE}/learn` });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));
    await send("Runtime.evaluate", {
      expression: `localStorage.setItem('trellis.anonymousOwnerId', '${OWNER_ID}')`,
      returnByValue: true,
    });

    let body = await navigate(send, "/learn", "当前最小课程组合");
    check("proposal explains finite curriculum", body.includes("不是完整课表") && body.includes("学习顺序"));
    check("proposal exposes course decisions", body.includes("主线") && body.includes("选定章节"));
    check("proposal preserves explicit gaps", body.includes("当前方案仍有缺口"));
    await screenshot(send, SHOTS.proposal);
    await verifyNoRuntimeError(send);

    await post(`/api/learning/curricula/${curriculum.id}/confirm`);
    const { current } = await get("/api/learning/current");
    check("curriculum activation completed", current.curriculum.activationStatus === "active");
    check("runtime keeps canonical course references", Boolean(current.activities[0]?.canonicalNodeId && current.activities[0]?.courseVersionId && current.activities[0]?.unitId));
    body = await navigate(send, "/learn", "当前片段");
    check("learn page exposes current unit", body.includes("本次范围") && body.includes("停止条件"));
    check("learn page has one primary start action", body.includes("开始这一节") && body.includes("学习反馈"));
    await screenshot(send, SHOTS.learn);
    await verifyNoRuntimeError(send);
    await send("Runtime.evaluate", {
      expression: `Array.from(document.querySelectorAll('button')).find((button) => button.textContent.includes('学习反馈'))?.click()`,
    });
    await waitForBody(send, "现在的感觉");
    await screenshot(send, SHOTS.feedback);
    await send("Runtime.evaluate", {
      expression: `document.querySelector('[role="dialog"] button[aria-label="关闭"]')?.click()`,
    });

    const activityId = current.activities[0].id;
    const { sourceResolution: initialSource } = await post(`/api/learning/runs/${activityId}/start`);
    check("opening a source starts without completing", initialSource.kind === "course_root" || initialSource.kind === "exact");
    let { current: resumed } = await get("/api/learning/current");
    check("started activity is resumable", resumed.resumeState.mode === "opened_without_feedback" && resumed.activities[0].status === "in_progress");
    await post(`/api/learning/runs/${activityId}/pause`, { reason: "验收暂停" });
    ({ current: resumed } = await get("/api/learning/current"));
    check("pause survives refresh", resumed.resumeState.mode === "paused" && resumed.activities[0].pauseReason === "验收暂停");
    await fetch(`${BASE}/api/learning/runs/${activityId}/location`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-trellis-owner-id": OWNER_ID },
      body: JSON.stringify({ sourceUrl: "https://www.deeplearning.ai/courses/", locatorLabel: "Course catalog · selected unit" }),
    });
    ({ current: resumed } = await get("/api/learning/current"));
    check("user-confirmed location becomes exact", resumed.sourceResolution.kind === "exact");
    body = await navigate(send, "/learn", "继续上次片段");
    check("learn page restores paused segment", body.includes("继续这一节") && body.includes("Course catalog · selected unit"));

    const { state: knowledgeState } = await post(`/api/learning/runs/${activityId}/feedback`, {
      type: "quiz_result",
      value: 86,
      note: "课程随堂测试通过",
      actualMinutes: 42,
      completionIntent: "complete",
    });
    check("light feedback updates canonical knowledge state", knowledgeState.status === "has_signal");
    ({ current: resumed } = await get("/api/learning/current"));
    check("feedback persists actual time and advances", resumed.activities[0].actualMinutes === 42 && resumed.activities[0].status === "completed");
    body = await navigate(send, "/learn", "最近变化");
    check("adaptation is visible after refresh", body.includes("课程原测验") && body.includes("已应用到当前学习") && body.includes("连续进度"));

    body = await navigate(send, "/grow", "AI 学习领域图");
    check("grow renders category structure", body.includes("AI 基础与边界") && body.includes("AI 产品判断"));
    check("grow explains route projection", body.includes("当前路线") && body.includes("下一里程碑"));
    await screenshot(send, SHOTS.grow);
    await verifyNoRuntimeError(send);

    const { resources } = await post("/api/learning/resources/inbox", {
      type: "link", title: "验收补充材料", content: "仅用于当前片段", sourceUrl: "https://example.com/reference", relatedNodeIds: [],
    });
    const resource = resources.find((item) => item.title === "验收补充材料");
    await post(`/api/learning/resources/${resource.id}/attachments`, { activityId: resumed.activities[1]?.id ?? activityId });
    body = await navigate(send, "/workbench", "验收补充材料");
    check("workbench is auxiliary", body.includes("NotebookLM") && body.includes("不决定主线课程"));
    check("course decisions stay out of workbench", !body.includes("课程采用状态"));
    check("workbench shows current attachment", body.includes("已附加当前片段"));
    await screenshot(send, SHOTS.workbench);
    await verifyNoRuntimeError(send);

    await send("Emulation.setDeviceMetricsOverride", {
      width: 1024,
      height: 768,
      deviceScaleFactor: 1,
      mobile: false,
    });
    body = await navigate(send, "/learn", "当前片段");
    const tabletOverflow = await send("Runtime.evaluate", {
      expression: "document.documentElement.scrollWidth > window.innerWidth + 2",
      returnByValue: true,
    });
    check("1024 layout has no horizontal overflow", tabletOverflow.result.value === false);

    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    body = await navigate(send, "/learn", "当前片段");
    check("mobile keeps the primary learning action", body.includes("开始这一节") && body.includes("学习反馈"));
    check("mobile navigation remains available", body.includes("工作台") && body.includes("成长"));
    const overflow = await send("Runtime.evaluate", {
      expression: "document.documentElement.scrollWidth > window.innerWidth + 2",
      returnByValue: true,
    });
    check("mobile has no severe horizontal overflow", overflow.result.value === false);
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
  const curriculum = await prepareState();
  await verifyBrowser(curriculum);
  if (process.exitCode) throw new Error("course-intelligence acceptance failed");
  console.log("PASS course-intelligence vertical slice");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
