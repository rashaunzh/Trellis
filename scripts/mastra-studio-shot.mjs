// Mastra Studio screenshot via CDP. No npm dependency.
// Usage: node scripts/mastra-studio-shot.mjs [baseUrl] [outPrefix]
//   baseUrl   default http://localhost:4111  (mastra dev server, Studio root)
//   outPrefix default docs/mastra-studio
// Requires `mastra dev` running (npm run mastra:dev). Starts one workflow run
// through the Mastra server API so Studio shows a real run, then captures:
//   1-studio-home / 2-workflows-list / 3-workflow-graph / 4-workflow-runs / 5-traces
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.argv[2] || "http://localhost:4111";
const OUT = process.argv[3] || "docs/mastra-studio";
const PORT = Number(process.env.TRELLIS_CDP_PORT ?? 9226);
const WORKFLOW_ID = "trellis-learning-situation-workflow";
const RUN_ID = "trellis-studio-demo-run";
const USER_DATA_DIR = resolve(".tmp-mastra-studio-chrome");

const DEMO_INPUT = {
  goal: "我是转 AI PM 的小白，希望 8 周内完成一个 AI Agent 产品 PRD 作品集项目",
  weeklyMinutes: 240,
  materialIds: ["res.gml-crash-course"],
  selfReport: {},
  preference: "breadth_first",
  workflowTrace: [],
};

function log(...args) {
  console.log(...args);
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

async function waitForJsonVersion() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (response.ok) return response.json();
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("Chrome CDP endpoint did not start");
}

async function waitForPageTarget() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const target = targets.find((item) => item.type === "page");
        if (target?.webSocketDebuggerUrl) return target;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("Chrome page target did not start");
}

function connectCdp(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve: ok, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else ok(message.result);
      return;
    }
    events.push(message);
  };
  const ready = new Promise((ok, reject) => {
    ws.onopen = ok;
    ws.onerror = reject;
  });
  return {
    ready,
    events,
    send(method, params = {}) {
      return new Promise((ok, reject) => {
        const messageId = ++id;
        pending.set(messageId, { resolve: ok, reject });
        ws.send(JSON.stringify({ id: messageId, method, params }));
      });
    },
    close() {
      ws.close();
    },
  };
}

async function evalValue(cdp, expression) {
  const res = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
  return res.result.value;
}

async function waitForBody(cdp, minLength = 80, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let body = "";
  while (Date.now() < deadline) {
    body = await evalValue(cdp, "document.body ? document.body.innerText : ''");
    if (body.length >= minLength) return body;
    await new Promise((r) => setTimeout(r, 600));
  }
  return body;
}

async function navigate(cdp, url, minLength = 40, timeoutMs = 15000) {
  await cdp.send("Page.navigate", { url });
  const body = await waitForBody(cdp, minLength, timeoutMs);
  await new Promise((r) => setTimeout(r, 1200));
  return body;
}

async function capture(cdp, path) {
  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(path, Buffer.from(shot.data, "base64"));
  log(`shot ${path} (${statSync(path).size} bytes)`);
}

async function startWorkflowRun() {
  // mastra server API: create-run → start. Node fetch keeps UTF-8 intact.
  const create = await fetch(
    `${BASE}/api/workflows/${WORKFLOW_ID}/create-run?runId=${RUN_ID}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId: "portfolio-demo", disableScorers: true }),
    },
  );
  const createText = await create.text();
  log(`create-run status=${create.status} body=${createText.slice(0, 160)}`);
  if (!create.ok) throw new Error(`create-run failed: ${create.status} ${createText}`);

  const start = await fetch(
    `${BASE}/api/workflows/${WORKFLOW_ID}/start?runId=${RUN_ID}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId: "portfolio-demo", inputData: DEMO_INPUT }),
    },
  );
  const startText = await start.text();
  log(`start status=${start.status} body=${startText.slice(0, 160)}`);
  if (!start.ok) throw new Error(`workflow start failed: ${start.status} ${startText}`);
  return JSON.parse(startText);
}

async function waitForRunDone() {
  const deadline = Date.now() + 30000;
  let last = "";
  while (Date.now() < deadline) {
    const response = await fetch(`${BASE}/api/workflows/${WORKFLOW_ID}/runs/${RUN_ID}`);
    if (response.ok) {
      const run = await response.json();
      last = JSON.stringify(run).slice(0, 300);
      const status = run?.status ?? "";
      if (["success", "failed", "error", "canceled", "bailed"].includes(status)) {
        log(`run finished: status=${status}`);
        return run;
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  log(`run did not finish in time; last=${last}`);
  return null;
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) throw new Error("Chrome or Edge executable not found");

  await startWorkflowRun();
  await waitForRunDone();

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
    "--disable-crashpad",
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
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // 1. Studio home
    await navigate(cdp, BASE, 80);
    log("home body head:", (await evalValue(cdp, "document.body.innerText")).slice(0, 160).replace(/\s+/g, " "));
    await capture(cdp, `${OUT}-1-studio-home.png`);

    // 2. Workflows list
    await navigate(cdp, `${BASE}/workflows`, 60);
    const listBody = await evalValue(cdp, "document.body.innerText");
    log("workflows list contains trellis:", listBody.includes("trellis-learning-situation-workflow"));
    await capture(cdp, `${OUT}-2-workflows-list.png`);

    // 3. Workflow graph detail
    const detailBody = await navigate(cdp, `${BASE}/workflows/${WORKFLOW_ID}`, 40, 20000);
    log("detail body head:", detailBody.slice(0, 300).replace(/\s+/g, " "));
    await new Promise((r) => setTimeout(r, 2500));
    const graphText = await evalValue(cdp, "document.body.innerText");
    for (const step of ["assessSituation", "auditMaterials", "mapCapabilities", "planStagePath", "simulateDynamicAdjustment", "createArtifactTask", "reviewArtifactEvidence", "waitForMasteryConfirmation", "proposeNextStage", "summarizeQuality"]) {
      log(`graph has ${step}:`, graphText.includes(step));
    }
    const hitlText = await evalValue(cdp,
      "JSON.stringify([...document.querySelectorAll('*')].filter(el => el.children.length === 0 && /human|hitl|confirm|wait/i.test(el.textContent || '')).slice(0, 15).map(el => el.textContent.trim().slice(0, 60)))");
    log("hitl-ish leaf texts:", hitlText);
    await capture(cdp, `${OUT}-3-workflow-graph.png`);

    // 4. Workflow runs (the run we started via API)
    await navigate(cdp, `${BASE}/workflows/${WORKFLOW_ID}/runs`, 40, 15000);
    await new Promise((r) => setTimeout(r, 3000));
    const runsBody = await evalValue(cdp, "document.body.innerText");
    log("runs page has runId:", runsBody.includes(RUN_ID));
    log("runs page head:", runsBody.slice(0, 400).replace(/\s+/g, " "));
    await capture(cdp, `${OUT}-4-workflow-runs.png`);

    // 4b. Run detail (step output)
    await navigate(cdp, `${BASE}/workflows/${WORKFLOW_ID}/runs/${RUN_ID}`, 40, 15000);
    await new Promise((r) => setTimeout(r, 3000));
    const runDetailBody = await evalValue(cdp, "document.body.innerText");
    log("run detail has RUN_ID:", runDetailBody.includes(RUN_ID));
    log("run detail head:", runDetailBody.slice(0, 500).replace(/\s+/g, " "));
    await capture(cdp, `${OUT}-4b-run-detail.png`);

    // 5. Observability traces
    await navigate(cdp, `${BASE}/traces`, 40, 15000);
    await new Promise((r) => setTimeout(r, 3000));
    const tracesBody = await evalValue(cdp, "document.body.innerText");
    log("traces page has runId:", tracesBody.includes(RUN_ID));
    log("traces page head:", tracesBody.slice(0, 400).replace(/\s+/g, " "));
    await capture(cdp, `${OUT}-5-traces.png`);

    cdp.close();
  } finally {
    chrome.kill();
  }
}

await main();
log("done");
