// Production smoke check. Set TRELLIS_BASE to a deployed URL.
const base = process.env.TRELLIS_BASE;
const ownerId = process.env.TRELLIS_OWNER_ID || "production-smoke-owner";
const authEmail = process.env.TRELLIS_AUTH_EMAIL || "";
const userAgent = "Mozilla/5.0 TrellisSmoke/1.0";

if (!base) {
  console.log("SKIP production smoke: TRELLIS_BASE is not set");
  process.exit(0);
}

const root = base.replace(/\/$/, "");
let failed = false;

function check(label, ok, detail = "") {
  if (ok) {
    console.log(`PASS ${label}${detail ? `: ${detail}` : ""}`);
  } else {
    failed = true;
    console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }
}

async function read(path, expectJson = false) {
  const response = await fetch(`${root}${path}`, {
    headers: {
      "user-agent": userAgent,
      ...(authEmail
        ? { "oai-authenticated-user-email": authEmail }
        : { "x-trellis-owner-id": ownerId }),
    },
    redirect: "manual",
  });
  const text = await response.text();
  if (!expectJson) return { response, text };
  try {
    return { response, json: JSON.parse(text), text };
  } catch {
    return { response, json: null, text };
  }
}

async function readWithHeaders(path, headers) {
  const response = await fetch(`${root}${path}`, { headers: { "user-agent": userAgent, ...headers }, redirect: "manual" });
  const text = await response.text();
  try { return { response, json: JSON.parse(text), text }; } catch { return { response, json: null, text }; }
}

async function write(path, body) {
  const response = await fetch(`${root}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": userAgent,
      ...(authEmail
        ? { "oai-authenticated-user-email": authEmail }
        : { "x-trellis-owner-id": ownerId }),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  try {
    return { response, json: JSON.parse(text), text };
  } catch {
    return { response, json: null, text };
  }
}

const learn = await read("/learn");
check("/learn reachable", learn.response.status === 200, String(learn.response.status));
check("/learn renders Trellis", learn.text.includes("Trellis") || learn.text.includes("学习"), "html");

const workbench = await read("/workbench");
check("/workbench reachable", workbench.response.status === 200, String(workbench.response.status));

const workspace = await read("/api/learning/workspace", true);
check("unauthenticated production API is protected", authEmail || workspace.response.status === 401, String(workspace.response.status));

const forgedOwner = await readWithHeaders("/api/learning/current", { "x-trellis-owner-id": "forged-production-owner" });
check("forged anonymous owner is rejected", forgedOwner.response.status === 401, String(forgedOwner.response.status));

if (!authEmail) {
  const forgedEmail = await readWithHeaders("/api/learning/current", { "oai-authenticated-user-email": "forged@example.com" });
  check("forged managed email is rejected by ingress", forgedEmail.response.status === 401, String(forgedEmail.response.status));
}

const review = await read("/api/learning/week-review", true);
check("week-review auth behavior", authEmail ? [200, 400].includes(review.response.status) : review.response.status === 401, String(review.response.status));

const runtime = await read("/api/learning/mastra-runtime", true);
check("formal Mastra runtime registered", runtime.response.status === 200
  && runtime.json?.runtime?.spec?.ids?.length === 4);

if (authEmail) {
  const intelligence = await read("/api/learning/intelligence/state", true);
  check("course intelligence catalog available", intelligence.response.status === 200
    && Number(intelligence.json?.state?.catalogCount ?? 0) > 0);

  const intake = await write("/api/learning/intake", {
    goal: "理解生成式 AI 的能力边界，并能判断一个 AI 产品场景",
    weeklyCapacity: "light",
    materials: [{ url: "https://www.deeplearning.ai/courses/" }],
  });
  check("intake starts suspended workflow", intake.response.status === 201
    && intake.json?.status === "suspended"
    && Boolean(intake.json?.workflowRunId)
    && Boolean(intake.json?.curriculum?.id));
  if (intake.json?.curriculum?.id) {
    const confirmed = await write(
      `/api/learning/curricula/${encodeURIComponent(intake.json.curriculum.id)}/confirm`,
      {},
    );
    check("curriculum confirmation resumes workflow", confirmed.response.status === 200
      && confirmed.json?.status === "completed"
      && confirmed.json?.curriculum?.activationStatus === "active");
  }
  const current = await read("/api/learning/current", true);
  check("unified current read model available", current.response.status === 200
    && current.json?.current
    && "workflow" in current.json.current
    && Array.isArray(current.json.current.activities));
  const workflow = await read(`/api/learning/workflows/${encodeURIComponent(intake.json?.workflowRunId ?? "missing")}`, true);
  check("workflow public status is readable by owner", workflow.response.status === 200 && workflow.json?.workflow?.id === intake.json?.workflowRunId);
} else {
  console.log("SKIP authenticated course loop: TRELLIS_AUTH_EMAIL is not set");
}

if (failed) process.exit(1);
console.log(`PASS production smoke ${root}`);
