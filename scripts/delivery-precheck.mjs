import { existsSync } from "node:fs";

const requiredFiles = [
  "README.md",
  "docs/product/TRELLIS_COURSE_INTELLIGENCE_PRODUCT_CONTRACT.md",
  "docs/product/TRELLIS_PORTFOLIO_CASE_STUDY.md",
  "docs/engineering/TRELLIS_3_MIN_DEMO_SCRIPT.md",
  "docs/architecture/TRELLIS_COURSE_INTELLIGENCE_ARCHITECTURE.md",
  "docs/engineering/DEPLOYMENT_RUNBOOK.md",
  "scripts/acceptance-course-intelligence.mjs",
  "scripts/production-smoke.mjs",
  "scripts/verify-migrations.mjs",
  "drizzle/migration-manifest.json",
  "drizzle/0014_canonical_learning_runtime.sql",
  "docs/acceptance-course-intelligence-proposal.png",
  "docs/acceptance-course-intelligence-learn.png",
  "docs/acceptance-course-intelligence-grow.png",
  "docs/acceptance-course-intelligence-workbench.png",
  "docs/acceptance-course-intelligence-mobile.png",
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
