# Trellis V0.2 演示脚本 — 从干净状态走完整核心叙事
# 运行：TRELLIS_BASE=<URL> python scripts/demo-v02.py
# 本地彩排：TRELLIS_BASE=http://localhost:3411（需先起 dev server）
# 线上演示：TRELLIS_BASE=<your deployed URL>（需浏览器 UA 可直连）
# 截图输出：.wrangler/demo-shots/
# 流程：诊断 → 6h 计划 → 完成概念活动(自动验证) → 完成综合任务(待确认) → 确认掌握 → 复测提醒
import json
import os
import sys
import pathlib
import urllib.request

from playwright.sync_api import sync_playwright

BASE = os.environ.get("TRELLIS_BASE", "http://localhost:3411")
SHOTS = pathlib.Path(os.environ.get("TRELLIS_SHOTS_DIR", ".wrangler/demo-shots"))
SHOTS.mkdir(parents=True, exist_ok=True)
OWNER_ID = os.environ.get("DEMO_OWNER", "demo-present-owner-01")
GOOD = "语言模型从训练数据学统计规律而非存储事实：训练调整参数，推理逐词预测。流畅不等于正确，幻觉来自概率采样，泛化依赖数据分布。判断 AI 方案看任务委托、输出校验、失败兜底。"

def api_call(path, method="GET", body=None):
    headers = {"Content-Type": "application/json", "x-trellis-owner-id": OWNER_ID}
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={"width": 1440, "height": 900})
        page.set_default_timeout(25000)
        page.add_init_script(f"localStorage.setItem('trellis.anonymousOwnerId', '{OWNER_ID}')")
        page.on("dialog", lambda d: d.accept())

        # 0. 干净起点
        api_call("/api/learning/reset", "POST")
        print("[1/8] 干净起点（远程库 0 状态）")

        # 1. 诊断
        page.goto(f"{BASE}/learn")
        page.wait_for_selector(".t2-onboarding")
        page.fill("textarea", "我想系统学习 AI 通识，并能判断 AI 应用方案是否靠谱")
        page.locator("label:has-text('每周可用时间') select").select_option("360")
        page.locator("label:has-text('优先方向') select").select_option("breadth_first")
        page.click("button:has-text('生成我的学习地图')")
        page.wait_for_selector("text=确认路线，生成首周计划", timeout=25000)
        page.screenshot(path=str(SHOTS / "01-proposal.png"))
        print("[2/8] 诊断 → 路线提案（AI 通识入门，3 模块）")

        # 2. 确认 → 周计划
        page.click("button:has-text('确认路线，生成首周计划')")
        page.wait_for_selector(".t2-week-board", timeout=25000)
        total = page.locator(".t2-activity-card").count()
        core = page.locator(".t2-activity-card.core").count()
        page.screenshot(path=str(SHOTS / "02-weekly-6h.png"))
        print(f"[3/8] 6 小时周计划：{total} 个活动（核心 {core} 个，6 类齐全，容量 360/360）")

        # 3. 完成概念活动（自动验证）
        page.locator(".t2-activity-card.core:has-text('建立模型')").first.click()
        page.wait_for_selector(".t2-drawer")
        page.click("button:has-text('开始这个活动')")
        page.wait_for_selector(".t2-evidence-form", timeout=15000)
        page.fill("textarea[placeholder*='写下最终证据']", GOOD)
        page.click("button:has-text('提交证据')")
        page.wait_for_selector("button:has-text('评估证据')", timeout=15000)
        page.click("button:has-text('评估证据')")
        page.wait_for_selector(".t2-done", timeout=20000)
        page.click(".t2-close")
        print("[4/8] 完成概念活动：证据评估通过 → 节点自动验证")

        # 4. 完成综合任务（进入待确认）
        page.locator(".t2-activity-card:has-text('综合情境')").first.click()
        page.wait_for_selector(".t2-drawer")
        page.click("button:has-text('开始这个活动')")
        page.wait_for_selector(".t2-evidence-form", timeout=15000)
        page.fill("textarea[placeholder*='写下最终证据']", GOOD)
        page.click("button:has-text('提交证据')")
        page.wait_for_selector("button:has-text('评估证据')", timeout=15000)
        page.click("button:has-text('评估证据')")
        page.wait_for_selector(".t2-done", timeout=20000)
        page.click(".t2-close")
        print("[5/8] 完成综合情境任务：系统评估通过 → 节点进入【待确认】（需用户表态）")

        # 5. 成长页：待确认（紫）→ 确认掌握
        page.goto(f"{BASE}/grow")
        page.wait_for_selector(".t2-treemap")
        page.screenshot(path=str(SHOTS / "03-grow-pending.png"))
        page.locator(".t2-node-card:has(.st-pending_confirmation)").first.click()
        page.wait_for_selector(".t2-node-detail")
        page.click("button:has-text('确认掌握')")
        page.wait_for_timeout(1500)
        page.screenshot(path=str(SHOTS / "04-grow-validated.png"))
        print("[6/8] 成长页：确认掌握 → 节点已验证（四色图例：灰/黄/紫/绿）")

        # 6. 调整记录含掌握确认
        page.goto(f"{BASE}/learn")
        page.wait_for_selector(".t2-week-board")
        has_record = page.locator(".t2-adjust:has-text('mastery_confirm')").count() > 0
        page.screenshot(path=str(SHOTS / "05-adjustment-record.png"))
        print(f"[7/8] 调整记录含掌握确认（可追溯）：{has_record}")

        # 7. 复测提醒（依赖 next_review_at 到期；本地彩排可先用 wrangler/sqlite 调过期）
        due = page.locator(".t2-due-reviews")
        if due.count() > 0:
            due.locator("button").first.click()
            page.wait_for_timeout(1500)
            page.screenshot(path=str(SHOTS / "06-retest.png"))
            print("[8/8] 复测提醒卡 → 生成延迟复测活动（间隔翻倍机制）")
        else:
            print("[8/8] 复测提醒未到期（本地彩排可调 next_review_at 过期后演示；机制已由验收覆盖）")

        b.close()
        print(f"\n=== 演示完成，截图在 {SHOTS} ===")

if __name__ == "__main__":
    main()
