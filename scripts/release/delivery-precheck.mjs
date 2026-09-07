import { existsSync } from "node:fs";

const requiredFiles = [
  "README.md",
  "docs/product/TRELLIS_COURSE_INTELLIGENCE_PRODUCT_CONTRACT.md",
  "docs/product/TRELLIS_PORTFOLIO_CASE_STUDY.md",
  "docs/product/TRELLIS_INTERNAL_TEST_PLAN.md",
  "docs/product/TRELLIS_INTERNAL_TEST_LOG.md",
  "docs/product/TRELLIS_PORTFOLIO_EVIDENCE_MATRIX.md",
  "docs/engineering/TRELLIS_3_MIN_DEMO_SCRIPT.md",
  "docs/architecture/TRELLIS_COURSE_INTELLIGENCE_ARCHITECTURE.md",
  "docs/architecture/TRELLIS_ARCHIFY_DIAGRAMS.md",
  "docs/architecture/MODEL_RUNTIME.md",
  "docs/engineering/DEPLOYMENT_RUNBOOK.md",
  "docs/engineering/TRELLIS_DEPLOYMENT_DECISION.md",
  "scripts/acceptance/acceptance-course-intelligence.mjs",
  "scripts/acceptance/acceptance-internal-test-loop.mjs",
  "scripts/acceptance/acceptance-agentic-kernel.mjs",
  "scripts/release/production-smoke.mjs",
  "scripts/release/model-smoke.mjs",
  "scripts/release/model-benchmark.mjs",
  "scripts/release/scan-secrets.mjs",
  "scripts/release/verify-migrations.mjs",
  "drizzle/migration-manifest.json",
  "drizzle/0014_canonical_learning_runtime.sql",
  "drizzle/0015_production_control_plane.sql",
  "drizzle/0016_agentic_decision_kernel.sql",
  "drizzle/0017_model_runtime_trace.sql",
  "drizzle/0018_functional_learning_loop.sql",
  "drizzle/0019_learning_continuity.sql",
  "drizzle/0020_content_sources.sql",
  "docs/acceptance-course-intelligence-proposal.png",
  "docs/acceptance-course-intelligence-learn.png",
  "docs/acceptance-course-intelligence-grow.png",
  "docs/acceptance-course-intelligence-workbench.png",
  "docs/acceptance-course-intelligence-mobile.png",
  "docs/acceptance-continuous-learning-learn.png",
  "docs/acceptance-continuous-learning-feedback.png",
  "docs/acceptance-continuous-learning-grow.png",
  "docs/acceptance-continuous-learning-workbench.png",
  "docs/acceptance-continuous-learning-mobile.png",
  "docs/acceptance-internal-test-first-use.png",
  "docs/acceptance-internal-test-resume.png",
  "docs/acceptance-internal-test-workbench.png",
  "docs/acceptance-internal-test-mobile.png",
  ".openai/hosting.json",
];

let failed = false;
for (const file of requiredFiles) {
  if (existsSync(file)) {
    console.log(`PASS ${file}`);
  } else {
    failed = true;
    console.error(`FAIL missing ${file}`);
  }
}

if (failed) process.exit(1);
console.log("PASS delivery assets present");
