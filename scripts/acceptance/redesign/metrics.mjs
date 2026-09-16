import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { summarizeDeliveryMetrics } from "../../../lib/learning/intelligence/delivery-metrics.ts";

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const inputPath = argument("events");
const version = argument("version");
const outputPath = argument("output");
const asOf = argument("as-of") ?? new Date().toISOString();
if (!inputPath || !version || !outputPath) throw new Error("用法：node scripts/acceptance/redesign/metrics.mjs --events=<事件JSON> --version=<产品版本> --output=<报告JSON> [--as-of=<ISO时间>]");
const events = JSON.parse(await readFile(resolve(inputPath), "utf8"));
if (!Array.isArray(events)) throw new Error("事件文件必须是数组，不包含答案或私有材料正文");
const report = summarizeDeliveryMetrics(events, asOf, version);
await writeFile(resolve(outputPath), JSON.stringify(report, null, 2));
console.log(`指标报告已生成：${resolve(outputPath)}；仅报告实际输入，缺少成熟样本时指标为null。`);
