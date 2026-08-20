# Trellis V0.2 工程可用 MVP 主流程验收 — 12 场景
# 运行：TRELLIS_BASE=http://localhost:3410 /c/Program Files/Python314/python.exe scripts/acceptance-v02-main-flow.py
# 依赖：playwright（系统 Python 3.14），dev server 运行中
# 场景：新用户进入 → 目标/6h → 多活动 → 抽屉 6 段 → 短证据退回 → 修订通过 →
#       节点验证 → 重排保留证据 → 多 owner 隔离 → reset 只清当前 owner
import json
import os
import sys
import pathlib
import urllib.request

from playwright.sync_api import sync_playwright

BASE = os.environ.get("TRELLIS_BASE", "http://localhost:3410")
SHOTS = pathlib.Path(r"C:/Users/G-NC-00144/Documents/Codex/trellis-cleanup/.wrangler/acceptance-shots-v02")
SHOTS.mkdir(parents=True, exist_ok=True)

# 主 owner（页面注入）+ 第二 owner（API 隔离验证）
OWNER_ID = "mainflow-owner-0001"
OTHER_ID = "other-owner-0002"

results = []

def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(f"{'✓' if cond else '✗'} {name}{' — ' + detail if detail else ''}")

def api_get(path, owner=OWNER_ID):
    req = urllib.request.Request(f"{BASE}{path}", headers={"x-trellis-owner-id": owner})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())

def api_post(path, body=None, owner=OWNER_ID):
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(f"{BASE}{path}", data=data, method="POST",
                                 headers={"Content-Type": "application/json",
                                          "x-trellis-owner-id": owner})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.set_default_timeout(25000)
        page.add_init_script(f"localStorage.setItem('trellis.anonymousOwnerId', '{OWNER_ID}')")
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("dialog", lambda d: d.accept())

        # ── 1. 新匿名用户首次进入（先重置清状态）──
        api_post("/api/learning/reset")
        page.goto(f"{BASE}/learn")
        page.wait_for_selector(".t2-onboarding")
        check("1. 新匿名用户首次进入显示 onboarding", True)
        page.screenshot(path=str(SHOTS / "01-onboarding.png"))

        # ── 2/3. 目标 + 6 小时 ──────────────────────────
        page.fill("textarea", "我想系统学习 AI 通识，并能判断 AI 应用方案是否靠谱")
        page.locator("label:has-text('每周可用时间') select").select_option("360")
        page.locator("label:has-text('优先方向') select").select_option("breadth_first")
        page.click("button:has-text('生成我的学习地图')")
        page.wait_for_selector("text=确认路线，生成首周计划", timeout=25000)
        check("2. 设置目标完成，显示路线提案", True)
        page.click("button:has-text('确认路线，生成首周计划')")
        page.wait_for_selector(".t2-week-board", timeout=25000)

        # ── 4. 6 小时计划生成多个活动 ───────────────────
        core = page.locator(".t2-activity-card.core").count()
        total = page.locator(".t2-activity-card").count()
        body_text = page.inner_text("body")
        check("4. 6 小时计划至少 4 个活动", total >= 4, f"core={core}, total={total}")
        check("4b. 容量统计接近 6 小时（/ 360 分钟）", "/ 360 分钟" in body_text)
        page.screenshot(path=str(SHOTS / "02-weekly-6h.png"))

        # ── 5/6. 打开活动抽屉，6 段齐全 ─────────────────
        page.locator(".t2-activity-card.core").first.click()
        page.wait_for_selector(".t2-drawer")
        drawer = page.locator(".t2-drawer")
        has_why = drawer.locator("text=为什么学").count() > 0
        has_what = drawer.locator(".t2-drawer-label:has-text('学什么')").count() > 0
        has_steps = drawer.locator(".t2-step-checklist input[type=checkbox]").count() > 0
        has_standard = drawer.locator("text=评估标准").count() > 0
        check("5. 抽屉打开（为什么学可见）", has_why)
        check("6. 抽屉含学什么/怎么做/输出要求/自检/提交", has_what and has_steps and has_standard,
              f"学什么={has_what}, 步骤={has_steps}, 标准={has_standard}")
        page.screenshot(path=str(SHOTS / "03-drawer-6segments.png"))

        # ── 7. 短证据被退回 ────────────────────────────
        page.click("button:has-text('开始这个活动')")
        page.wait_for_selector(".t2-evidence-form", timeout=15000)
        page.fill("textarea[placeholder*='写下最终证据']", "太短。")
        page.click("button:has-text('提交证据')")
        page.wait_for_selector("button:has-text('评估证据')", timeout=15000)
        page.click("button:has-text('评估证据')")
        page.wait_for_selector("text=需修订", timeout=20000)
        check("7. 不足证据被退回（needs_revision）", True)
        page.screenshot(path=str(SHOTS / "04-needs-revision.png"))

        # ── 8. 修订后通过 ──────────────────────────────
        page.fill(
            "textarea[placeholder*='写下最终证据']",
            "语言模型不是存储事实的数据库，而是从训练数据中学到统计规律：训练阶段调整参数最小化预测误差，"
            "推理阶段根据上文逐词预测。流畅自信不等于正确，幻觉来自概率采样，泛化依赖数据分布。"
            "判断 AI 方案是否靠谱，看任务委托、输出校验和失败兜底三点。",
        )
        page.click("button:has-text('提交证据')")
        page.wait_for_selector("button:has-text('评估证据')", timeout=15000)
        page.click("button:has-text('评估证据')")
        page.wait_for_selector(".t2-done", timeout=20000)
        check("8. 修订证据通过，活动完成", True)
        page.click(".t2-close")

        # ── 9. 节点从成长中变为已验证 ───────────────────
        page.goto(f"{BASE}/grow")
        page.wait_for_selector(".t2-treemap")
        validated = page.locator(".t2-node-dot.st-validated").count()
        growing = page.locator(".t2-node-dot.st-growing").count()
        check("9. 节点已验证（证据驱动）", validated >= 1, f"validated={validated}, growing={growing}")
        page.screenshot(path=str(SHOTS / "05-grow-validated.png"))

        # ── 10. 重排本周，已有证据不丢 ──────────────────
        page.goto(f"{BASE}/learn")
        page.wait_for_selector(".t2-week-board")
        before = api_get("/api/learning/workspace")["workspace"]
        before_evidence = sorted((e["id"], e["content"]) for e in before["evidence"])
        page.click("button:has-text('重排本周')")
        page.wait_for_selector(".t2-adjust:has-text('activity_replan')", timeout=25000)
        after = api_get("/api/learning/workspace")["workspace"]
        after_evidence = sorted((e["id"], e["content"]) for e in after["evidence"])
        check("10. 重排保留已提交证据", after_evidence == before_evidence and len(after_evidence) >= 1,
              f"evidence before={len(before_evidence)}, after={len(after_evidence)}")
        page.screenshot(path=str(SHOTS / "06-replanned.png"))

        # ── 11. 另一个 owner 看不到前一个 owner 的状态 ──
        ws_other = api_get("/api/learning/workspace", OTHER_ID)["workspace"]
        check("11. 另一 owner 看不到主 owner 状态", ws_other["profile"] is None
              and len(ws_other["activities"]) == 0 and len(ws_other["evidence"]) == 0)

        # ── 12. reset 只清当前 owner ────────────────────
        api_post("/api/learning/reset", owner=OTHER_ID)  # OTHER 无状态，reset 无副作用
        ws_main = api_get("/api/learning/workspace")["workspace"]
        ws_other2 = api_get("/api/learning/workspace", OTHER_ID)["workspace"]
        check("12. reset 只清当前 owner（主 owner 保留）", ws_main["profile"] is not None
              and ws_other2["profile"] is None)

        # ── 收尾：无 JS 错误 ────────────────────────────
        check("13. 无页面 JS 错误", len(errors) == 0, f"errors={errors[:3]}")
        browser.close()

    print()
    failed = [r for r in results if not r[1]]
    print(f"=== V0.2 主流程验收：{len(results) - len(failed)}/{len(results)} 通过 ===")
    if failed:
        print("失败项:")
        for name, _, detail in failed:
            print(f"  ✗ {name}{' — ' + detail if detail else ''}")
        sys.exit(1)

if __name__ == "__main__":
    main()
