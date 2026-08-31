import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { validateArtifact } from "./validate-artifact.mjs";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RUNTIME_ROOT = resolve(process.env.SITES_RUNTIME_ROOT ?? ".sites-runtime");
const BUILD_TIMEOUT_MS = Number(process.env.SITES_BUILD_TIMEOUT_MS ?? 180_000);
const BUILD_KILL_AFTER_MS = Number(process.env.SITES_BUILD_KILL_AFTER_MS ?? 10_000);

async function prepareEnv() {
  const dirs = [
    "home",
    "npm-cache",
    "xdg-config",
    "tmp",
    "wrangler/logs",
  ];

  await Promise.all(dirs.map((dir) => mkdir(resolve(RUNTIME_ROOT, dir), { recursive: true })));

  const env = {
    ...process.env,
    SITES_ENV_READY: "1",
    SITES_PROJECT_ROOT: PROJECT_ROOT,
    HOME: resolve(RUNTIME_ROOT, "home"),
    XDG_CONFIG_HOME: resolve(RUNTIME_ROOT, "xdg-config"),
    TMPDIR: resolve(RUNTIME_ROOT, "tmp"),
    WRANGLER_WRITE_LOGS: "false",
    WRANGLER_LOG_PATH: resolve(RUNTIME_ROOT, "wrangler/logs"),
    MINIFLARE_REGISTRY_PATH: resolve(RUNTIME_ROOT, "wrangler/registry"),
    npm_config_cache: resolve(RUNTIME_ROOT, "npm-cache"),
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_update_notifier: "false",
  };

  delete env.npm_config_proxy;
  delete env.npm_config_http_proxy;
  delete env.npm_config_https_proxy;
  delete env.NPM_CONFIG_PROXY;
  delete env.NPM_CONFIG_HTTP_PROXY;
  delete env.NPM_CONFIG_HTTPS_PROXY;

  return env;
}

function runBuild(env) {
  const vinextBin = resolve(PROJECT_ROOT, "node_modules/.bin", process.platform === "win32" ? "vinext.cmd" : "vinext");
  if (!existsSync(vinextBin)) {
    throw new Error("vinext is unavailable. Run npm run install:ci and wait for it to finish before building.");
  }

  const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : vinextBin;
  const args = process.platform === "win32" ? ["/d", "/c", vinextBin, "build"] : ["build"];

  const child = spawn(command, args, {
    cwd: PROJECT_ROOT,
    env,
    stdio: "inherit",
    shell: false,
  });

  let killTimer = null;
  const buildTimer = setTimeout(() => {
    console.error(`vinext build exceeded ${BUILD_TIMEOUT_MS}ms; sending TERM.`);
    child.kill("SIGTERM");
    killTimer = setTimeout(() => {
      console.error(`vinext build did not stop after ${BUILD_KILL_AFTER_MS}ms; sending KILL.`);
      child.kill("SIGKILL");
    }, BUILD_KILL_AFTER_MS);
  }, BUILD_TIMEOUT_MS);

  return new Promise((resolveRun, rejectRun) => {
    child.on("error", rejectRun);
    child.on("exit", (code, signal) => {
      clearTimeout(buildTimer);
      if (killTimer) clearTimeout(killTimer);
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(new Error(`vinext build failed with code ${code ?? "null"} signal ${signal ?? "null"}`));
    });
  });
}

const env = await prepareEnv();
await runBuild(env);
await validateArtifact();
