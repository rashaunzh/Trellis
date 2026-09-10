import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "node:net";
import http from "node:http";
import { DatabaseSync } from "node:sqlite";

// 所有状态落在本次输出目录。只启动自己的服务，不附着个人开发数据库。
export async function isolatedServer(directory) {
  const listener = createServer();
  await new Promise(done => listener.listen(0, "127.0.0.1", done));
  const port = listener.address().port;
  await new Promise(done => listener.close(done));
  const base = `http://127.0.0.1:${port}`;
  const configPath = resolve(directory, "wrangler.json");
  const statePath = resolve(directory, "state");
  const config = { name: "trellis-redesign-test", compatibility_date: "2026-05-01", compatibility_flags: ["nodejs_compat"], main: resolve("worker/index.ts"), d1_databases: [{ binding: "DB", database_name: "trellis-redesign-test", database_id: "00000000-0000-4000-8000-000000000000", migrations_dir: resolve("drizzle") }] };
  await writeFile(configPath, JSON.stringify(config));
  // Wrangler 以配置目录解析变量；空文件防止继承个人 .dev.vars。
  await writeFile(resolve(directory, ".dev.vars"), "# isolated baseline acceptance\n");
  const env = { ...process.env, TRELLIS_ACCEPTANCE_CONFIG: configPath, TRELLIS_ACCEPTANCE_STATE: statePath, CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false", WRANGLER_SEND_METRICS: "false", WRANGLER_LOG_PATH: resolve(directory, "wrangler.log") };
  const migrateLog = createWriteStream(resolve(directory, "migration.log"));
  await new Promise((done, reject) => {
    const migration = spawn(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "migrations", "apply", "DB", "--local", "--config", configPath, "--persist-to", statePath], { env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    migration.stdout.pipe(migrateLog, { end: false }); migration.stderr.pipe(migrateLog, { end: false });
    migration.stdin.end("y\n");
    migration.on("error", reject);
    migration.on("exit", code => { migrateLog.end(); if (code === 0) done(); else reject(new Error(`本地隔离迁移失败 ${code}，见 migration.log`)); });
  });
  let child;
  let log;
  async function start() {
    log = createWriteStream(resolve(directory, "server.log"), { flags: "a" });
    child = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let failure;
    child.on("error", error => { failure = error; });
    child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      if (failure || child.exitCode !== null) throw failure ?? new Error(`服务退出 ${child.exitCode}，见 server.log`);
      try {
        const ready = await new Promise((done, reject) => {
          const request = http.get(`${base}/learn`, { headers: { Connection: "close" } }, response => { response.resume(); done(response.statusCode === 200); });
          request.setTimeout(15000, () => request.destroy(new Error("启动探测超时")));
          request.on("error", reject);
        });
        if (ready) return;
      } catch { /* 仍在编译 */ }
      await new Promise(done => setTimeout(done, 500));
    }
    throw new Error("隔离服务90秒内未就绪，见 server.log");
  }
  async function stop() {
    if (child && child.exitCode === null) { const exited = new Promise(done => child.once("exit", done)); child.kill(); await exited; }
    log?.end();
  }
  try { await start(); } catch (error) { await stop(); throw error; }
  async function inspectDatabase(sql, values = []) {
    const files = await readdir(statePath, { recursive: true });
    for (const file of files.filter(name => name.endsWith(".sqlite"))) {
      const db = new DatabaseSync(resolve(statePath, file), { readOnly: true });
      try {
        if (db.prepare("SELECT name FROM sqlite_master WHERE name='learning_ci_curricula'").get()) return db.prepare(sql).all(...values);
      } finally { db.close(); }
    }
    throw new Error("未找到本次隔离产品数据库");
  }
  return { base, statePath, stop, inspectDatabase, restart: async () => { await stop(); await start(); } };
}
