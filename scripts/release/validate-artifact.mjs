import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PROJECT_ROOT = resolve(process.env.SITES_PROJECT_ROOT ?? ".");

export async function validateArtifact() {
  const workerPath = resolve(PROJECT_ROOT, "dist/server/index.js");
  const hostingPath = resolve(PROJECT_ROOT, "dist/.openai/hosting.json");

  if (!existsSync(workerPath)) {
    throw new Error("Missing Sites Worker entry: dist/server/index.js");
  }
  if (!existsSync(hostingPath)) {
    throw new Error("Missing packaged Sites manifest: dist/.openai/hosting.json");
  }

  JSON.parse(await readFile(hostingPath, "utf8"));

  const workerUrl = pathToFileURL(workerPath);
  workerUrl.searchParams.set("sites-validation", `${process.pid}-${Date.now()}`);
  const worker = await import(workerUrl.href);
  if (!worker.default || typeof worker.default.fetch !== "function") {
    throw new Error("dist/server/index.js must have an ESM default export with fetch(request, env, ctx)");
  }

  console.log("Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await validateArtifact();
}
