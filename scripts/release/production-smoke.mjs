// Production smoke check. Set TRELLIS_BASE to a deployed URL.
const base = process.env.TRELLIS_BASE;
const ownerId = process.env.TRELLIS_OWNER_ID || "production-smoke-owner";
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
      "x-trellis-owner-id": ownerId,
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

const learn = await read("/learn");
check("/learn reachable", learn.response.status === 200, String(learn.response.status));
check("/learn renders Trellis", learn.text.includes("Trellis") || learn.text.includes("学习"), "html");

const workbench = await read("/workbench");
check("/workbench reachable", workbench.response.status === 200, String(workbench.response.status));

const workspace = await read("/api/learning/workspace", true);
check("/api/learning/workspace returns json", workspace.response.status === 200 && Boolean(workspace.json?.workspace));
check("workspace fallback shape", workspace.json?.workspace && "profile" in workspace.json.workspace);

const review = await read("/api/learning/week-review", true);
check("/api/learning/week-review returns stable response", [200, 400].includes(review.response.status), String(review.response.status));

if (failed) process.exit(1);
console.log(`PASS production smoke ${root}`);
