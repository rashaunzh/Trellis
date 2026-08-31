import http from "node:http";
import https from "node:https";

const base = process.env.TRELLIS_BASE ?? "http://127.0.0.1:5174";
const ownerId = "agentic-kernel-acceptance-owner";
let failed = false;

function check(label, condition, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`);
  if (!condition) failed = true;
}

function requestOnce(path, { method = "GET", body, headers = {} } = {}) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  const url = new URL(path, base);
  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolvePromise, rejectPromise) => {
    const req = transport.request(url, {
      method,
      agent: false,
      headers: {
        "x-trellis-owner-id": ownerId, "connection": "close", ...headers,
        ...(payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}),
      },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { /* response remains inspectable as text */ }
        resolvePromise({ status: response.statusCode ?? 0, json, text });
      });
    });
    req.setTimeout(30_000, () => req.destroy(new Error(`${path} timed out`)));
    req.on("error", rejectPromise);
    req.end(payload);
  });
}

async function request(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await requestOnce(path, options);
      const retryableRestart = response.status === 503
        && ((options.method ?? "GET") === "GET" || path === "/api/learning/reset");
      if (!retryableRestart || attempt === 3) return response;
      console.warn(`RETRY ${path} after local worker restart (${attempt}/3)`);
    } catch (error) {
      lastError = error;
      if (attempt < 3) console.warn(`RETRY ${path} after transport timeout (${attempt}/3)`);
    }
  }
  throw lastError;
}

const initialReset = await request("/api/learning/reset", { method: "POST", body: {} });
check("formal runtime can start from a clean owner state", initialReset.status === 200);
const state = await request("/api/learning/intelligence/state");
check("published catalog and graph", state.status === 200 && state.json?.state?.catalogCount >= 25 && state.json?.state?.graph?.nodes?.length >= 30);

const intake = await request("/api/learning/intake", { method: "POST", body: {
  goal: "判断 Agent 产品场景，设计能力边界、人工兜底和最小评测方案",
  weeklyCapacity: "light",
  materials: [{ url: "https://www.deeplearning.ai/courses/" }],
} });
check("curriculum workflow suspends for user", intake.status === 201 && intake.json?.status === "suspended" && Boolean(intake.json?.decisionId));
const workflowId = intake.json?.workflowRunId;
const curriculumId = intake.json?.curriculum?.id;
const workflow = await request(`/api/learning/workflows/${encodeURIComponent(workflowId)}`);
check("workflow status is owner isolated and readable", workflow.status === 200 && workflow.json?.workflow?.status === "suspended");

const confirmed = await request(`/api/learning/curricula/${encodeURIComponent(curriculumId)}/confirm`, { method: "POST", body: {} });
check("curriculum confirmation resumes same run", confirmed.status === 200 && confirmed.json?.workflowRunId === workflowId && confirmed.json?.status === "completed");

const current = await request("/api/learning/current");
const activity = current.json?.current?.activities?.[0];
check("current read model exposes exact chapter", current.status === 200 && activity?.courseVersionId && activity?.unitId && activity?.canonicalNodeId);

const feedback = await request(`/api/learning/runs/${encodeURIComponent(activity?.id)}/feedback`, { method: "POST", body: {
  type: "quiz_result", value: 86, note: "课程随堂测试通过",
} });
check("learning adaptation advances with canonical state", feedback.status === 200 && feedback.json?.state?.status === "has_signal" && feedback.json?.interpretation?.outcome === "advance");

const legacy = await request("/api/learning/diagnostic", { method: "POST", body: { goal: "legacy" } });
check("legacy mutation is disabled by default", legacy.status === 410);

const reset = await request("/api/learning/reset", { method: "POST", body: {} });
const afterReset = await request("/api/learning/current");
check(
  "formal reset clears user runtime",
  reset.status === 200 && afterReset.status === 200 && afterReset.json?.current?.curriculum === null,
  `reset=${reset.status} current=${afterReset.status} curriculum=${afterReset.json?.current?.curriculum?.id ?? "null"} body=${reset.text.slice(0, 180)}`,
);

if (failed) process.exit(1);
console.log(`PASS agentic kernel acceptance ${base}`);
