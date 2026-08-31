import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = process.cwd();

const REQUIRED = [
  "README.md",
  "package.json",
  "package-lock.json",
  "app/learn/page.tsx",
  "app/api/learning/eval/route.ts",
  "app/api/learning/mastra-runtime/route.ts",
  "lib/learning/agents/mastra-workflow.ts",
  "lib/learning/agents/next-stage-planner.ts",
  "lib/learning/agents/evidence-evaluator.ts",
  "tests/learning-domain/portfolio-orchestration.test.ts",
  "scripts/compatibility/acceptance-portfolio-full-loop.mjs",
  "scripts/compatibility/acceptance-next-stage-rubric.mjs",
  "docs/product/TRELLIS_PORTFOLIO_AGENTIC_LEARNING_COMPANION.md",
  "docs/product/TRELLIS_PORTFOLIO_DEMO_SCRIPT.md",
  "docs/engineering/PORTFOLIO_AGENT_DISTRIBUTION.md",
  "docs/engineering/PORTFOLIO_RELEASE_CHECKLIST.md",
  "docs/engineering/TRELLIS_PORTFOLIO_DELIVERY_MANIFEST.md",
  "docs/acceptance-portfolio-stage-path.png",
  "docs/acceptance-portfolio-onboarding.png",
  "docs/acceptance-portfolio-next-stage.png",
  "docs/learn-next-stage-rubric.png",
  "src/mastra/index.ts",
];

const PUBLIC_ROOTS = new Set([
  "app",
  "build",
  "db",
  "docs",
  "drizzle",
  "lib",
  "public",
  "scripts",
  "src",
  "tests",
  "worker",
]);

const PUBLIC_ROOT_FILES = new Set([
  ".gitattributes",
  ".gitignore",
  ".node-version",
  ".npmrc",
  ".nvmrc",
  "AGENTS.md",
  "drizzle.config.ts",
  "eslint.config.mjs",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "postcss.config.mjs",
  "README.md",
  "tsconfig.json",
  "vite.config.ts",
  "worker-types.d.ts",
]);

const DENY_DIRS = new Set([
  ".git",
  ".mastra",
  ".next",
  ".sites-runtime",
  ".vinext",
  ".wrangler",
  "dist",
  "memory",
  "node_modules",
  "out",
]);

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".py",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const SECRET_PATTERNS = [
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i, "private_key"],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/, "openai_like_key"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/, "github_pat"],
  [/\bghp_[A-Za-z0-9]{20,}\b/, "github_token"],
  [/\bAKIA[0-9A-Z]{16}\b/, "aws_access_key"],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/, "jwt"],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, "email"],
  [/\bC:\/Users\//i, "windows_user_path"],
  [/\bD:\/(?!Download\/Feishu\/EchoMind)/i, "local_drive_path"],
  [/\bD:\\/i, "local_drive_path"],
  [/\brashaunzh\b/i, "personal_handle"],
  [/\b33f222cb9c9aba8aa61c426e922d556d\b/i, "cloudflare_account_id"],
  [/\b5490481c-c5a9-4423-8906-6a0d0e6e278f\b/i, "d1_database_id"],
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (DENY_DIRS.has(entry.name) || entry.name.startsWith(".tmp-")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path, files);
      continue;
    }
    files.push(relative(ROOT, path).replaceAll("\\", "/"));
  }
  return files;
}

function isPublicCandidate(path) {
  const [root] = path.split("/");
  if (path.startsWith("docs/archive/")) return false;
  if (PUBLIC_ROOT_FILES.has(path)) return true;
  return PUBLIC_ROOTS.has(root);
}

const missing = REQUIRED.filter((path) => !existsSync(join(ROOT, path)));
const candidates = walk(ROOT).filter(isPublicCandidate).sort();
const blockedCandidates = candidates.filter((path) => path === "memory" || path.startsWith("memory/"));
const findings = [];

for (const path of candidates) {
  if (!TEXT_EXTENSIONS.has(extname(path))) continue;
  const fullPath = join(ROOT, path);
  if (statSync(fullPath).size > 1_000_000) continue;
  const text = readFileSync(fullPath, "utf8");
  const lines = text.split(/\r?\n/);
  for (const [lineIndex, line] of lines.entries()) {
    for (const [pattern, label] of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        findings.push(`${path}:${lineIndex + 1}:${label}`);
      }
    }
  }
}

for (const path of missing) console.error(`MISSING ${path}`);
for (const path of blockedCandidates) console.error(`BLOCKED ${path}`);
for (const finding of findings) console.error(`FINDING ${finding}`);

console.log(`Checked ${candidates.length} public candidate files.`);
console.log(`Required files: ${REQUIRED.length - missing.length}/${REQUIRED.length}.`);
console.log(`Sensitive findings: ${findings.length}.`);

if (missing.length || blockedCandidates.length || findings.length) {
  process.exitCode = 1;
}
