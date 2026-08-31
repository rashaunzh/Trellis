// Trellis portfolio next-stage rubric browser acceptance via Chrome DevTools Protocol.
// No npm dependency required. Run with dev server active:
//   node scripts/acceptance-next-stage-rubric.mjs
// 共享：CDP / API helpers 导出供 acceptance-portfolio-full-loop.mjs 复用；
// 直接运行时才执行验收（import 时不触发副作用）。
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const BASE = process.env.TRELLIS_BASE ?? "http://127.0.0.1:5174";
export const OWNER_ID = "next-stage-rubric-owner";
export const PORT = Number(process.env.TRELLIS_CDP_PORT ?? 0) || 9224 + (process.pid % 1000);
export const SHOT = resolve("docs/learn-next-stage-rubric.png");
export const USER_DATA_DIR = resolve(`.tmp-next-stage-chrome-${process.pid}`);

export function check(name, condition, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
  if (!condition) process.exitCode = 1;
}

export async function apiPost(path, body = {}, ownerId = OWNER_ID) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-trellis-owner-id": ownerId,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path} -> ${response.status}: ${await response.text()}`);
  return response.json();
}

async function prepareDemoState() {
  await apiPost("/api/learning/reset");
  await apiPost("/api/learning/diagnostic", {
    goal: "我是转 AI PM 的小白，希望完成一个 AI Agent 产品 PRD 作品集项目",
    weeklyMinutes: 240,
    materialIds: ["res.openai-evals"],
    preference: "build_first",
  });
  await apiPost("/api/learning/proposal/confirm");
  let workspace = (await apiPost("/api/learning/artifact")).workspace;
  const artifact = workspace.activities.find((activity) => activity.title.includes("AI Agent 产品 PRD"));
  if (!artifact) throw new Error("portfolio artifact activity not found");

  await apiPost(`/api/learning/activities/${artifact.id}/start`);
  workspace = (await apiPost(`/api/learning/activities/${artifact.id}/evidence`, {
    evidenceType: "artifact",
    content:
      "AI Agent 产品 PRD v1：用户场景描述是一位 AI PM 转型小白在三周内需要完成可评审作品，问题陈述拆解为目标模糊、资料错配、时间容量变化和证据不足。成功标准定义为能输出 PRD、案例拆解和评测方案，并被第三方复核。方案与需求区分清楚，价值假设说明完整。能力清单拆解包括处境识别、资料评估、阶段路径、动态调整和证据评审。输入输出定义包括学习目标、资料、时间精力信号、行为信号、作品证据，输出 next best move、active risks、stage path 和调整记录。可评测标准包括计划完成率、证据通过率、资料错配次数和评审置信度。能力边界说明 soft signal 只影响下一步决策，不能直接 validated。人工兜底设计包括主路径变化、作品方向确认和掌握确认。评测结果引用 eval suite 的 situation、material fit、stage path、dynamic adjustment、artifact loop。上线回滚判断依据失败标准，用户感知指标和系统指标区分明确，产品改进建议是补齐下一阶段讲述。",
  })).workspace;
  const evidence = workspace.evidence.find((item) => item.activityId === artifact.id);
  if (!evidence) throw new Error("portfolio evidence not found");

  workspace = (await apiPost(`/api/learning/evidence/${evidence.id}/review`)).workspace;
  workspace = (await apiPost(`/api/learning/nodes/${artifact.nodeId}/confirm-mastery`, {
    decision: "confirmed",
  })).workspace;
  const adjustment = workspace.adjustments.find((item) =>
    item.adjustmentType === "route_revision" && item.status === "proposed"
  );
  if (!adjustment) throw new Error("next stage adjustment not found");
  workspace = (await apiPost(`/api/learning/adjustments/${adjustment.id}/confirm`)).workspace;

  check("next stage plan exists", Boolean(workspace.nextStagePlan));
  check(
    "formal next-stage activities generated",
    workspace.activities.filter((activity) => activity.title.startsWith("下一阶段：")).length === 3,
  );
}

export function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

export async function waitForJsonVersion() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (response.ok) return response.json();
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
    }
  }
  throw new Error("Chrome CDP endpoint did not start");
}

export async function waitForPageTarget() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const target = targets.find((item) => item.type === "page");
        if (target?.webSocketDebuggerUrl) return target;
      }
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
    }
  }
  throw new Error("Chrome page target did not start");
}

export function connectCdp(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve: resolvePending, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolvePending(message.result);
      return;
    }
    events.push(message);
  };
  const ready = new Promise((resolveReady, rejectReady) => {
    ws.onopen = resolveReady;
    ws.onerror = rejectReady;
  });
  return {
    ready,
    events,
    send(method, params = {}) {
      return new Promise((resolveSend, rejectSend) => {
        const messageId = ++id;
        pending.set(messageId, { resolve: resolveSend, reject: rejectSend });
        ws.send(JSON.stringify({ id: messageId, method, params }));
      });
    },
    close() {
      ws.close();
    },
  };
}

async function verifyBrowser() {
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
    await send("Page.navigate", { url: `${BASE}/learn` });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 800));
    await send("Runtime.evaluate", {
      expression: `localStorage.setItem('trellis.anonymousOwnerId', '${OWNER_ID}')`,
      returnByValue: true,
    });
    await send("Page.navigate", { url: `${BASE}/learn` });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));
    let body = "";
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const bodyPoll = await send("Runtime.evaluate", {
        expression: "document.readyState + '::' + document.body.innerText",
        returnByValue: true,
      });
      const readyAndBody = bodyPoll.result.value ?? "";
      body = readyAndBody.split("::").slice(1).join("::");
      if (body.length > 100 && !body.includes("正在准备你的学习环境")) break;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
    }

    check("page renders content", body.length > 100);
    check("page renders Next Stage panel", body.includes("AI PM 作品集包装阶段"));
    check("rubric visible: Learning Situation-first", body.includes("Learning Situation-first"));
    check("rubric visible: runtime fallback", body.includes("runtime fallback"));
    check("rubric visible: 10-15 minutes", body.includes("10-15 分钟"));
    check("formal activity count visible", body.includes("已生成 3 个正式活动"));

    const overlayResult = await send("Runtime.evaluate", {
      expression: "document.querySelector('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay') ? 'ERROR_OVERLAY' : 'OK'",
      returnByValue: true,
    });
    check("no framework error overlay", overlayResult.result.value === "OK", overlayResult.result.value);

    if (body.length > 100) await send("Runtime.evaluate", {
      expression: "document.querySelector('.t2-next-stage-plan')?.scrollIntoView({ block: 'start' })",
      returnByValue: true,
    });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
    if (body.length > 100) {
      const screenshot = await send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
      });
      writeFileSync(SHOT, Buffer.from(screenshot.data, "base64"));
      check("screenshot saved", statSync(SHOT).size > 10000, SHOT);
    }
    check(
      "no browser exceptions",
      !cdp.events.some((event) => event.method === "Runtime.exceptionThrown"),
    );
    cdp.close();
  } finally {
    chrome.kill();
  }
}

// 直接运行时执行验收；被其他脚本 import 时仅导出 helpers，不触发副作用。
const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  await prepareDemoState();
  await verifyBrowser();
  if (process.exitCode) process.exit(process.exitCode);
  console.log(`SHOT ${SHOT}`);
}
