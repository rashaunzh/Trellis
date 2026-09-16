import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const requiredFiles = [
  "README.md", "AGENTS.md", "docs/README.md",
  "docs/product/TRELLIS_COURSE_INTELLIGENCE_PRODUCT_CONTRACT.md",
  "docs/product/TRELLIS_DESKTOP_UPDATE_DESIGN_2026-09-14.md",
  "docs/engineering/PROJECT_STATUS.md",
  "docs/engineering/LOCAL_DEVELOPMENT.md",
  "docs/engineering/DEPLOYMENT_RUNBOOK.md",
  "docs/engineering/REPOSITORY_CLEANUP_2026-09-14.md",
  "docs/architecture/TRELLIS_COURSE_INTELLIGENCE_ARCHITECTURE.md",
  "docs/architecture/MODEL_RUNTIME.md",
  "docs/product/evidence/pm-independent-2026-09-14/README.md",
  "scripts/acceptance/acceptance-course-intelligence.mjs",
  "scripts/acceptance/acceptance-internal-test-loop.mjs",
  "scripts/acceptance/acceptance-agentic-kernel.mjs",
  "scripts/release/scan-secrets.mjs", "scripts/release/verify-migrations.mjs",
  "drizzle/migration-manifest.json", ".openai/hosting.json",
];
const errors = [];
for (const file of requiredFiles) if (!existsSync(file)) errors.push(`missing ${file}`);

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(file) : entry.name.endsWith(".md") ? [file] : [];
  });
}
const documents = ["README.md", "AGENTS.md", ...markdownFiles("docs"),
  ...["memory/README.md", "memory/decisions", "memory/handoff", "memory/sessions"].flatMap(file =>
    file.endsWith(".md") ? [file] : markdownFiles(file))];
for (const file of documents) {
  const content = readFileSync(file, "utf8");
  for (const match of content.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    const href = match[1].trim().replace(/^<|>$/g, "");
    if (/^(?:https?:|mailto:|#)/i.test(href)) continue;
    const target = decodeURIComponent(href.split("#")[0]);
    if (target && !existsSync(resolve(dirname(file), target))) errors.push(`broken link in ${file}: ${href}`);
  }
}
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const privatePaths = tracked.filter(file =>
  /^(?:memory\/(?:profile|routes)\/|\.vscode\/|outputs\/|\.env(?:\.|$)|\.dev\.vars(?:\.|$))/.test(file));
for (const file of privatePaths) errors.push(`local-only path remains tracked: ${file}`);
for (const directory of ["scripts/legacy", "docs/archive", "docs/portfolio"]) {
  if (tracked.some(file => file.startsWith(directory + "/"))) errors.push(`retired directory remains tracked: ${directory}`);
}
if (errors.length) {
  for (const error of errors) console.error(`FAIL ${error}`);
  process.exit(1);
}
console.log(`PASS delivery entrypoints (${requiredFiles.length}), document links (${documents.length}) and repository boundaries`);
console.log("This check does not establish production readiness, history sanitization or learning outcomes.");
