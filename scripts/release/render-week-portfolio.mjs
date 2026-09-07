import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { findChrome } from "../lib/browser-cdp.mjs";
const require = createRequire(`${process.env.USERPROFILE}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json`);
const { chromium } = require("playwright");
const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(pathToFileURL(resolve("outputs/week-delivery/Trellis-AI-PM.html")).href);
  for (let i = 0; i < 8; i++) {
    await page.evaluate(index => window.show(index), i);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight)) throw new Error(`Slide ${i + 1} overflow`);
    await page.screenshot({ path: `outputs/week-delivery/slide-${i + 1}.png` });
  }
  await page.pdf({ path: "outputs/week-delivery/Trellis-AI-PM.pdf", width: "13.333in", height: "7.5in", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  const { owner } = JSON.parse(await readFile("outputs/week-delivery/browser.json", "utf8"));
  if (process.argv.includes("--video")) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { "x-trellis-owner-id": owner }, recordVideo: { dir: "outputs/week-delivery/video", size: { width: 1280, height: 900 } } });
    const demo = await context.newPage();
    const scenes = [
      ["learn", "01 · 已确认路线与本周行动。预置测试用户；本片为自动录制演示，非真实用户测试。"],
      ["workbench", "02 · 已提供文本的片段审阅。规则映射仅作候选，不代表完整课程核验。"],
      ["grow", "03 · 领域结构与方向。学习信号不代表能力掌握。"],
      ["learn", "04 · 不确定反馈保留当前任务。路线提案需要确认，当前学习持续可用。"],
    ];
    for (const [route, caption] of scenes) {
      await demo.goto(`http://127.0.0.1:3410/${route}`); await demo.waitForLoadState("networkidle");
      await demo.evaluate(text => { const bar = document.createElement("div"); bar.textContent = text; bar.style.cssText = "position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#103623;color:#e3ffed;padding:20px;font:18px sans-serif;border-top:1px solid #7eefa4"; document.body.append(bar); }, caption);
      console.log(`Recording ${route}`);
      await demo.waitForTimeout(20000);
      await demo.evaluate(() => window.scrollBy({ top: 600, behavior: "smooth" }));
      await demo.waitForTimeout(20000);
    }
    await demo.goto(pathToFileURL(resolve("outputs/week-delivery/Trellis-AI-PM.html")).href);
    await demo.evaluate(() => window.show(5)); await demo.waitForTimeout(20000);
    await demo.evaluate(() => window.show(7)); await demo.waitForTimeout(20000);
    const video = demo.video(); await context.close(); await video.saveAs("outputs/week-delivery/Trellis-demo.webm");
  }
  console.log("Portfolio rendered and checked");
} finally { await browser.close(); }
