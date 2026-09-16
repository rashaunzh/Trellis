// 顺序门禁。单独选择 phase 是诊断运行，不构成完整验收。
import { spawnSync } from "node:child_process";
const phases = ["judgment", "browser", "model"];
const requested = process.argv.find(arg => arg.startsWith("--phase="))?.split("=")[1];
if (requested && ![...phases, "program"].includes(requested)) throw new Error("phase 必须是 judgment、browser、model 或 program（内容原型诊断）");
for (const phase of requested ? [requested] : phases) {
  const result = spawnSync(process.execPath, [`scripts/acceptance/redesign/${phase}.mjs`, ...process.argv.slice(2).filter(arg => !arg.startsWith("--phase="))], { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) { console.error(`STOP ${phase} ${result.status === 2 ? "待验收（缺少环境或人工证据）" : "自动检查失败"}；后续轮次未执行。`); process.exit(result.status ?? 1); }
}
console.log("自动化轮次完成；真人连续使用与真实登录验收须单独完成，不能据此宣称放行。");
