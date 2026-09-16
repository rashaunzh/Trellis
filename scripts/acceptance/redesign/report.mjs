import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
export const fingerprint = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function sourceFingerprint() {
  const files = ["package.json", "vite.config.ts"];
  for (const root of ["app", "lib", "worker", "src", "scripts/acceptance"]) {
    for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
      if (entry.isFile() && /\.(?:ts|tsx|mjs|json|css)$/.test(entry.name)) files.push(resolve(entry.parentPath, entry.name));
    }
  }
  return fingerprint(await Promise.all(files.sort().map(async file => [file.replace(resolve("."), "."), await readFile(file, "utf8")])));
}
export async function createReport(phase, metadata = {}) {
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${phase}-${process.pid}`;
  const directory = resolve("outputs/redesign-core", runId);
  await mkdir(directory, { recursive: true });
  const report = { runId, generatedAt: new Date().toISOString(), sourceHash: await sourceFingerprint(), phase, status: "running", ...metadata, checks: [], humanValidation: "not_run", releasePassed: false };
  async function save() {
    report.automatedPassed = report.status === "completed" && report.checks.length > 0 && report.checks.every(item => item.status === "passed");
    await writeFile(resolve(directory, "result.json"), JSON.stringify(report, null, 2) + "\n");
  }
  async function check(id, execute) {
    const start = performance.now();
    try { const detail = await execute(); report.checks.push({ id, status: "passed", durationMs: Math.round(performance.now() - start), detail }); }
    catch (error) { report.checks.push({ id, status: "failed", durationMs: Math.round(performance.now() - start), error: error.message }); }
    console.log(`${report.checks.at(-1).status.toUpperCase()} ${id}`);
    await save();
    return report.checks.at(-1).status === "passed";
  }
  return { directory, report, check, save };
}
export function validateReview(review, outputsHash, dimensions, caseIds) {
  if (review.outputsHash !== outputsHash || !review.reviewer?.trim()) return false;
  return caseIds.every(id => dimensions.every(dimension => {
    const score = review.cases?.[id]?.[dimension];
    return score?.score === 2 && typeof score.evidence === "string" && score.evidence.trim().length > 0;
  }));
}
export async function readJson(path) { return JSON.parse(await readFile(path, "utf8")); }
