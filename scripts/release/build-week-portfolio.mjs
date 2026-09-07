// 生成可编辑 PPTX 和可浏览的面试展示稿；不把模拟观察写为结果。
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const require = createRequire(`${process.env.USERPROFILE}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json`);
const PptxGenJS = require("pptxgenjs");
const dir = "outputs/week-delivery";
await mkdir(dir, { recursive: true });
const benchmark = JSON.parse(await readFile("outputs/model-benchmark/latest.json", "utf8"));
const primary = benchmark.reports.find(item => item.slot === "primary");
const fallback = benchmark.reports.find(item => item.slot === "fallback");
const slides = [
  ["Trellis", "从材料囤积，到有依据的学习路线", ["AI 产品完整实践 · 受控演示版", "材料判断 → 路线提案 → 用户确认 → 行动与反馈", "当前证据：工程验证与模型实测；用户效果和商业假设待验证"]],
  ["01 / 问题", "有材料，仍然难以决定如何学", ["真实起因：不清楚课程是否合理、适配自己，以及先学什么。", "首期聚焦 AI 与 AI PM 学习，控制内容与评估范围。", "问题来自所有者经历；外部访谈尚未完成，不外推市场规模。"]],
  ["02 / 产品判断", "路线必须解释取舍", ["材料质量与适配性分开：可信来源也可能暂不适合。", "已有购买不构成必学理由，允许采用、补充、暂缓和排除。", "新提案不会覆盖当前学习；重大调整经过确认。"]],
  ["03 / 产品演示", "材料成为路线中的可追溯引用", ["按提供文本拆分片段，明确未读范围。", "逐片段审阅，已确认版本进入路线。", "当前规则映射仅作候选，仍需语义质量验证。"]],
  ["04 / AI 设计", "模型候选与程序约束分别负责", ["模型：目标理解、目录提取、章节映射候选。", "程序：已知引用、编排约束、状态与用户确认。", "失败：信息不足或退回已发布基线，不伪造阅读和理解。"]],
  ["05 / 验证", "保留失败，才能判断可靠性", [`主模型 ${primary.model}：${primary.passed}/${primary.total}，${primary.totalLatencyMs} ms，${primary.totalTokens} tokens。`, `备用 ${fallback.model}：${fallback.passed}/${fallback.total}；未达到发布门槛。`, "这是固定协议/grounding 任务结果，不等于用户学习效果；独立路线评分待完成。"]],
  ["06 / 迭代", "一次完成，不能被称为掌握", ["发现：uncertain 被推进、自报测试被判强证据、草稿隐藏任务。", "修改：反馈保持开放、证据降级、确认状态分离与跨周恢复。", "验证：回归测试与浏览器流程；来源是代码审计，不冒充用户观察。"]],
  ["07 / 复盘", "用下一轮证据决定继续投入", ["商业：比较一次性诊断与持续服务，尚无付费结果。", "待验证：独立用户、连续使用、语义材料质量和完整事务。", "个人贡献须作者核对；Codex 协助研究、实现、测试与展示稿。"]],
];
const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE"; pptx.author = "Trellis 项目"; pptx.subject = "AI PM 作品集初稿"; pptx.title = "Trellis 一周投递版"; pptx.lang = "zh-CN";
for (const [index, item] of slides.entries()) {
  const slide = pptx.addSlide(); slide.background = { color: "0B100E" };
  slide.addText(item[0], { x: .65, y: .45, w: 12, h: .4, fontFace: "Microsoft YaHei", fontSize: 16, color: "7EEFA4" });
  slide.addText(item[1], { x: .65, y: 1.1, w: 11.9, h: 1.05, fontFace: "Microsoft YaHei", fontSize: 32, bold: true, color: "EDF4EF", breakLine: false });
  item[2].forEach((text, row) => slide.addText(text, { x: .85, y: 2.6 + row * 1.05, w: 11.55, h: .8, fontFace: "Microsoft YaHei", fontSize: 20, color: "BCCBC1", margin: 0, breakLine: false }));
  slide.addText(`${index + 1} / 8  ·  2026-09-06  ·  受控演示 / 未验证长期效果`, { x: .65, y: 6.8, w: 12, h: .25, fontFace: "Microsoft YaHei", fontSize: 10, color: "A8B8AF" });
  slide.addNotes(`依据：docs/product/TRELLIS_WEEK_CASE_STUDY.md、TRELLIS_WEEK_RESEARCH.md、outputs/model-benchmark/latest.json。${item[2].join("\n")}\n请作者用自己的话解释判断与贡献，不能把稿件当作已完成面试记录。`);
}
await pptx.writeFile({ fileName: `${dir}/Trellis-AI-PM.pptx` });
const esc = text => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Trellis · AI PM 作品集</title><style>
*{box-sizing:border-box}body{margin:0;background:#0b100e;color:#edf4ef;font:22px/1.6 'Microsoft YaHei',sans-serif}section{display:none;min-height:100vh;padding:6vh 8vw;background:radial-gradient(ellipse at top right,#194c3055,transparent 60%)}section.active{display:block}small{color:#7eefa4}h1{font-size:clamp(32px,4vw,58px);max-width:1000px;line-height:1.25;margin:30px 0 65px}p{max-width:1050px;margin:28px 0;color:#bccbc1}footer{position:fixed;bottom:30px;left:8vw;color:#a8b8af;font-size:14px}nav{position:fixed;right:5vw;bottom:25px;display:flex;gap:12px}button{background:#173826;color:#d8f4e2;border:1px solid #50785f;border-radius:20px;padding:10px 22px;cursor:pointer}@media print{section{display:block!important;break-after:page;min-height:95vh}nav,footer{display:none}}
</style>${slides.map((item,index)=>`<section class="${index===0?"active":""}"><small>${esc(item[0])}</small><h1>${esc(item[1])}</h1>${item[2].map(text=>`<p>${esc(text)}</p>`).join("")}</section>`).join("")}<footer id="counter"></footer><nav><button onclick="show(index-1)">上一页</button><button onclick="show(index+1)">下一页</button></nav><script>let index=0;function show(n){index=Math.max(0,Math.min(7,n));document.querySelectorAll('section').forEach((s,i)=>s.classList.toggle('active',i===index));document.getElementById('counter').textContent=(index+1)+' / 8 · 受控演示版 · 2026-09-06'}document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(index+1);if(e.key==='ArrowLeft')show(index-1)});show(0)</script></html>`;
await writeFile(`${dir}/Trellis-AI-PM.html`, html);
console.log(`Created ${dir}/Trellis-AI-PM.pptx and .html`);
