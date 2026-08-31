# Trellis V0.2 MVP 浏览器验收 — 完整用户旅程
# 运行：TRELLIS_BASE=http://localhost:3400 python scripts/browser-acceptance.py
# 依赖：playwright（系统 Python 3.14 已装），dev server 运行在 3400 端口
import json
import os
import sys
import pathlib
import traceback

from playwright.sync_api import sync_playwright

BASE = os.environ.get("TRELLIS_BASE", "http://localhost:3400")
SHOTS = pathlib.Path(os.environ.get("TRELLIS_SHOTS_DIR", ".wrangler/acceptance-shots"))
SHOTS.mkdir(parents=True, exist_ok=True)

results = []

def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(f"{'✓' if cond else '✗'} {name}{' — ' + detail if detail else ''}")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.set_default_timeout(15000)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        # ── 1. 学习页 onboarding ──────────────────────
        page.goto(f"{BASE}/learn")
        page.wait_for_selector("text=你希望学会后能完成什么")
        check("1. 学习页显示 onboarding（目标输入）", True)
        page.screenshot(path=str(SHOTS / "01-onboarding.png"))

        # 填目标 → 生成学习地图
        page.fill("textarea", "学会用 AI 搭建知识问答应用并评估其可靠性")
        page.click("button:has-text('生成我的学习地图')")
        page.wait_for_selector("text=确认路线，生成首周计划", timeout=20000)
        check("2. 诊断后显示路线提案", True)
        page.screenshot(path=str(SHOTS / "02-proposal.png"))

        # ── 2. 确认路线 → 周计划 ─────────────────────
        page.click("button:has-text('确认路线，生成首周计划')")
        page.wait_for_selector("text=本周进度", timeout=20000)
        check("3. 确认后显示本周计划", True)
        page.screenshot(path=str(SHOTS / "03-weekly-plan.png"))

        # 打开活动抽屉 → 开始
        page.click(".t2-activity-card")
        page.wait_for_selector("text=操作步骤")
        check("4. 活动抽屉打开（步骤/证据/评估标准）", True)
        page.screenshot(path=str(SHOTS / "04-activity-drawer.png"))
        page.click("button:has-text('开始这个活动')")
        page.wait_for_selector("text=提交你的证据", timeout=15000)
        check("5. 开始活动 → 显示证据提交表单", True)

        # 提交不足证据 → 退回
        page.fill("textarea", "太短。")
        page.click("button:has-text('提交证据')")
        page.wait_for_selector("text=评估证据", timeout=15000)
        check("6. 证据提交 → 等待评估", True)
        page.click("button:has-text('评估证据')")
        page.wait_for_selector("text=需修订", timeout=15000)
        check("7. 不足证据被退回（needs_revision）", True)
        page.screenshot(path=str(SHOTS / "05-needs-revision.png"))

        # ── 3. 修订证据 → 接受 → 节点变色 ────────────
        page.fill("textarea",
            "模型从数据中学习模式而不是保存事实，生成是在上下文中预测后续内容。"
            "训练时调整参数，推理时根据概率输出。流畅自信与正确是不同的事，"
            "幻觉说明概率性输出的边界，泛化依赖训练数据分布。")
        page.click("button:has-text('提交证据')")
        page.wait_for_selector("text=评估证据", timeout=15000)
        page.click("button:has-text('评估证据')")
        page.wait_for_selector("text=✓ 活动已完成", timeout=15000)
        check("8. 修订证据被接受，活动完成", True)
        page.screenshot(path=str(SHOTS / "06-accepted.png"))

        # ── 4. 成长页节点变色 ────────────────────────
        page.goto(f"{BASE}/grow")
        page.wait_for_selector(".t2-node-map")
        validated = page.locator(".t2-node-dot.st-validated").count()
        growing = page.locator(".t2-node-dot.st-growing").count()
        check("9. 成长页节点变色（已验证 ≥1）", validated >= 1, f"validated={validated}, growing={growing}")
        page.screenshot(path=str(SHOTS / "07-grow-map.png"))

        # 点开已验证节点看详情
        page.locator(".t2-node-card").first.click()
        page.wait_for_selector(".t2-node-detail")
        check("10. 节点详情（证据/等级/支持证据）", True)
        page.screenshot(path=str(SHOTS / "08-node-detail.png"))

        # ── 5. 刷新保留 + 工作台 ─────────────────────
        page.reload()
        page.wait_for_selector(".t2-node-map")
        validated_after = page.locator(".t2-node-dot.st-validated").count()
        check("11. 刷新后节点状态保留", validated_after >= 1, f"validated={validated_after}")

        page.goto(f"{BASE}/workbench")
        page.wait_for_selector(".t2-resource-card")
        resources = page.locator(".t2-resource-card").count()
        tools = page.locator(".t2-tool-card").count()
        check("12. 工作台资源/工具卡片", resources >= 1 and tools >= 1, f"resources={resources}, tools={tools}")
        page.screenshot(path=str(SHOTS / "09-workbench.png"))

        # ── 6. 三 tab 导航 ───────────────────────────
        nav = page.locator(".t2-sidebar nav a").all_inner_texts()
        check("13. 导航只有学习/成长/工作台", len(nav) == 3, f"nav={nav}")

        check("14. 无页面 JS 错误", len(errors) == 0, f"errors={errors}")
        browser.close()

    print()
    failed = [r for r in results if not r[1]]
    print(f"=== 浏览器验收：{len(results) - len(failed)}/{len(results)} 通过 ===")
    if failed:
        print("失败项:", [r[0] for r in failed])
        sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
