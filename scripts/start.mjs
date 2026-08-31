import { spawn } from "node:child_process";

const child = spawn(process.execPath, [
  "node_modules/vinext/dist/cli.js",
  "start",
  ...process.argv.slice(2),
], {
  stdio: "inherit",
  env: {
    ...process.env,
    WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH || ".wrangler/wrangler.log",
  },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
