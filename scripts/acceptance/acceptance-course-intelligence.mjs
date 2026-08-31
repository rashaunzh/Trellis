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

const OWNER_ID = "course-intelligence-acceptance-owner";
const SHOTS = {
  proposal: resolve("docs/acceptance-course-intelligence-proposal.png"),
  learn: resolve("docs/acceptance-course-intelligence-learn.png"),
  grow: resolve("docs/acceptance-course-intelligence-grow.png"),
  workbench: resolve("docs/acceptance-course-intelligence-workbench.png"),
  mobile: resolve("docs/acceptance-course-intelligence-mobile.png"),
};

const post = (path, body = {}) => apiPost(path, body, OWNER_ID);

async function get(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "x-trellis-owner-id": OWNER_ID },
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
  while (Date.now() < deadline) {
    const result = await send("Runtime.evaluate", {
      expression: "document.readyState + '::' + document.body.innerText",
      returnByValue: true,
    });
    const body = String(result.result.value ?? "").split("::").slice(1).join("::");
    if (body.length > 100 && body.includes(expected)) return body;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error(`page body did not contain "${expected}"`);
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

    let body = await navigate(send, "/learn", "检查 Trellis 的课程取舍");
    check("proposal explains target interpretation", body.includes("对目标的理解") && body.includes("用户原始目标"));
    check("proposal exposes course decisions", body.includes("当前主线") && body.includes("只学选定章节"));
    check("proposal exposes exact units", body.includes("少量课程，精确到章节") && body.includes("退出"));
    await screenshot(send, SHOTS.proposal);
    await verifyNoRuntimeError(send);

    await post(`/api/learning/curricula/${curriculum.id}/confirm`);
    const { current } = await get("/api/learning/current");
    check("curriculum activation completed", current.curriculum.activationStatus === "active");
    check("runtime keeps canonical course references", Boolean(current.activities[0]?.canonicalNodeId && current.activities[0]?.courseVersionId && current.activities[0]?.unitId));
    body = await navigate(send, "/learn", "继续当前最值得推进的一节");
    check("learn page exposes current unit", body.includes("学到这里就可以停") && body.includes("打开这一节"));
    check("learn page uses learning feedback", body.includes("学习反馈") && body.includes("本周采用的准确章节"));
    await screenshot(send, SHOTS.learn);
    await verifyNoRuntimeError(send);

    const { state: knowledgeState } = await post(`/api/learning/runs/${current.activities[0].id}/feedback`, {
      type: "quiz_result",
      value: 86,
      note: "课程随堂测试通过",
    });
    check("light feedback updates canonical knowledge state", knowledgeState.status === "has_signal");
    body = await navigate(send, "/learn", "Building AI Projects");
    check("next action advances to the next exact unit", body.includes("本周路线") && body.includes("1/5"));

    body = await navigate(send, "/grow", "AI 学习领域图");
    check("grow renders category structure", body.includes("AI 基础与边界") && body.includes("AI 产品判断"));
    check("grow explains route projection", body.includes("当前路线") && body.includes("36"));
    await screenshot(send, SHOTS.grow);
    await verifyNoRuntimeError(send);

    body = await navigate(send, "/workbench", "工具、外部知识库和暂存内容");
    check("workbench is auxiliary", body.includes("NotebookLM") && body.includes("不决定主线课程"));
    check("course decisions stay out of workbench", !body.includes("课程采用状态"));
    await screenshot(send, SHOTS.workbench);
    await verifyNoRuntimeError(send);

    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    body = await navigate(send, "/learn", "继续当前最值得推进的一节");
    check("mobile keeps the primary learning action", body.includes("打开这一节") && body.includes("学习反馈"));
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
