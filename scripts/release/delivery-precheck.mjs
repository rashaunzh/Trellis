import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const requiredFiles = [
  "README.md", "CONTRIBUTING.md", "AGENTS.md", "docs/README.md",
  ".env.example", ".github/pull_request_template.md", ".github/workflows/ci.yml",
  "docs/product/TRELLIS_COURSE_INTELLIGENCE_PRODUCT_CONTRACT.md",
  "docs/product/TRELLIS_DESKTOP_UPDATE_DESIGN_2026-09-14.md",
  "docs/engineering/PROJECT_STATUS.md",
  "docs/engineering/LOCAL_DEVELOPMENT.md",
  "docs/engineering/DEPLOYMENT_RUNBOOK.md",
  "docs/engineering/REPOSITORY_DELIVERY_STANDARD.md",
  "docs/architecture/DECISIONS.md",
  "docs/architecture/TRELLIS_COURSE_INTELLIGENCE_ARCHITECTURE.md",
  "docs/architecture/MODEL_RUNTIME.md",
  "docs/product/evidence/pm-independent-2026-09-14/README.md",
  "scripts/acceptance/acceptance-course-intelligence.mjs",
  "scripts/acceptance/acceptance-internal-test-loop.mjs",
  "scripts/acceptance/acceptance-agentic-kernel.mjs",
  "scripts/release/scan-secrets.mjs", "scripts/release/verify-migrations.mjs",
  "drizzle/migration-manifest.json", "wrangler.migrate.json", ".openai/hosting.json",
];
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const trackedSet = new Set(tracked);
const errors = [];
for (const file of requiredFiles) {
  if (!existsSync(file)) errors.push(`missing ${file}`);
  else if (!trackedSet.has(file)) errors.push(`delivery entrypoint is not tracked: ${file}`);
}
// Only shipped documents count. An ignored local file must not make a clone look complete.
const documents = tracked.filter(file => file.endsWith(".md") && existsSync(file));
for (const file of documents) {
  const content = readFileSync(file, "utf8");
  for (const match of content.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    const href = match[1].trim().replace(/^<|>$/g, "");
    if (/^(?:https?:|mailto:|#)/i.test(href)) continue;
    const target = decodeURIComponent(href.split("#")[0]);
    if (!target) continue;
    const absolute = resolve(dirname(file), target);
    const repositoryPath = relative(resolve("."), absolute).replaceAll("\\", "/");
    if (!existsSync(absolute)) errors.push(`broken link in ${file}: ${href}`);
    else if (!trackedSet.has(repositoryPath) && !tracked.some(item => item.startsWith(repositoryPath.replace(/\/$/, "") + "/"))) {
      errors.push(`link target is not shipped in ${file}: ${href}`);
    }
  }
}
const privatePaths = tracked.filter(file =>
  file !== ".env.example" && (
    /^(?:memory\/(?:profile|routes)\/|\.vscode\/|\.agents\/|\.codex\/|outputs\/|\.env(?:\.|$)|\.dev\.vars(?:\.|$))/.test(file)
    || file.startsWith("memory/sessions/") && file !== "memory/sessions/latest.md"
  ));
for (const file of privatePaths) errors.push(`local-only path remains tracked: ${file}`);
for (const directory of ["scripts/legacy", "docs/archive", "docs/portfolio", "docs/agents", "docs/development", "memory/decisions"]) {
  if (tracked.some(file => file.startsWith(directory + "/"))) errors.push(`retired directory remains tracked: ${directory}`);
}
if (errors.length) {
  for (const error of errors) console.error(`FAIL ${error}`);
  process.exit(1);
}
console.log(`PASS delivery entrypoints (${requiredFiles.length}), document links (${documents.length}) and repository boundaries`);
console.log("This check does not establish production readiness, history sanitization or learning outcomes.");
