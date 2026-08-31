# Trellis V0.2 验收：温和重排本周（weekly replan）
# 运行：python scripts/acceptance-replan.py
# 依赖：playwright（系统 Python 3.14 已装），dev server 运行在 3400 端口
# 流程：观察入口 → 重新设置 → 诊断(8h/全局认知) → 确认路线 → 首周计划检查 →
#       活动闭环(开始/足量证据/评估通过) → 成长页(节点/中文/相邻分支) →
#       重排本周 → 证据/节点保留 + 新活动 + activity_replan 记录 + 状态未清空
import json
import os
import sys
import pathlib
import urllib.request

from playwright.sync_api import sync_playwright

BASE = os.environ.get("TRELLIS_BASE", "http://localhost:3400")
SHOTS = pathlib.Path(os.environ.get("TRELLIS_SHOTS_DIR", ".wrangler/acceptance-shots-replan"))
SHOTS.mkdir(parents=True, exist_ok=True)

# 匿名 owner 隔离后：浏览器页面请求带 localStorage ownerId，
# 脚本 API 快照必须用同一 owner，否则快照落在 DEFAULT_OWNER 上（两者状态不同）。
OWNER_ID = "acceptance-owner-0001"

results = []

def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(f"{'✓' if cond else '✗'} {name}{' — ' + detail if detail else ''}")

def api_get(path):
    req = urllib.request.Request(f"{BASE}{path}", headers={"x-trellis-owner-id": OWNER_ID})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode())

def api_post(path, body=None):
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(f"{BASE}{path}", data=data, method="POST",
                                 headers={"Content-Type": "application/json",
                                          "x-trellis-owner-id": OWNER_ID})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        # 每次导航前注入固定 ownerId，使页面 fetch 与脚本 API 快照落在同一 owner
        page.add_init_script(f"localStorage.setItem('trellis.anonymousOwnerId', '{OWNER_ID}')")
        page.set_default_timeout(20000)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("dialog", lambda d: d.accept())  # 重排本周/重新设置 的 confirm 全部接受

        # ── 1. 打开 /learn，观察入口 ──────────────────
        page.goto(f"{BASE}/learn")
        page.wait_for_selector(".t2-onboarding, .t2-topbar")
        has_state = page.locator(".t2-topbar").count() > 0
        if has_state:
            replan_btn = page.locator("button:has-text('重排本周')").count()
            reset_btn = page.locator(".t2-reset-btn:has-text('重新设置')").count()
            check("1. 已有状态时可见「重排本周」入口", replan_btn == 1, f"replan_btn={replan_btn}")
            check("2. 已有状态时可见「重新设置」入口", reset_btn == 1, f"reset_btn={reset_btn}")
            page.screenshot(path=str(SHOTS / "00-existing-state.png"))
            # 重新设置 → 回 onboarding
            page.click(".t2-reset-btn")
            page.wait_for_selector(".t2-onboarding")
            check("3. 点重新设置后回到初始诊断", True)
        else:
            # 全新库：入口观察标记 N/A，重排完成后在视图 3 补验（见步骤 28a/28b）
            check("1. 已有状态时可见「重排本周」入口", True, "N/A：全新库起点，重排后补验")
            check("2. 已有状态时可见「重新设置」入口", True, "N/A：全新库起点，重排后补验")
            check("3. 点重新设置后回到初始诊断", True, "N/A：全新库起点，无需重置")
        page.screenshot(path=str(SHOTS / "01-onboarding.png"))

        # ── 2. 重新诊断（目标/8小时/全局认知）──────────
        page.fill("textarea", "我想系统学习 AI 通识，并能判断 AI 应用方案是否靠谱")
        page.locator("label:has-text('每周可用时间') select").select_option("480")
        page.locator("label:has-text('优先方向') select").select_option("breadth_first")
        page.click("button:has-text('生成我的学习地图')")
        page.wait_for_selector("text=确认路线，生成首周计划", timeout=25000)
        check("4. 诊断完成，显示路线提案", True)
        page.screenshot(path=str(SHOTS / "02-proposal.png"))

        # ── 3. 确认路线 → 首周计划 ────────────────────
        page.click("button:has-text('确认路线，生成首周计划')")
        page.wait_for_selector(".t2-week-board", timeout=25000)
        check("5. 确认路线后生成首周计划", True)
        page.screenshot(path=str(SHOTS / "03-weekly.png"))

        # ── 4. 学习页检查 ─────────────────────────────
        core_count = page.locator(".t2-activity-card.core").count()
        total_count = page.locator(".t2-activity-card").count()
        check("6. 本周看板有多个核心活动", core_count >= 3, f"core={core_count}, total={total_count}")
        body_text = page.inner_text("body")
        check("7. 容量统计接近 8 小时（/ 480 分钟）", "/ 480 分钟" in body_text and "核心承诺" in body_text,
              f"核心承诺片段={[s for s in body_text.splitlines() if '核心承诺' in s]}")

        # 打开第一个核心活动抽屉（planned 状态：步骤/标准可见）
        page.locator(".t2-activity-card.core").first.click()
        page.wait_for_selector(".t2-drawer")
        drawer = page.locator(".t2-drawer")
        has_steps = drawer.locator(".t2-step-checklist input[type=checkbox]").count() > 0
        has_standard = drawer.locator("text=评估标准").count() > 0
        check("8. 抽屉含步骤勾选", has_steps)
        check("9. 抽屉含产出证据与评估标准", has_standard)
        page.screenshot(path=str(SHOTS / "04-drawer-planned.png"))

        # ── 5. 活动闭环：开始 → 足量证据 → 评估通过 ────
        page.click("button:has-text('开始这个活动')")
        page.wait_for_selector(".t2-evidence-form", timeout=15000)
        # in_progress 状态：笔记/自检/证据类型/外部链接 全部出现
        has_notes = drawer.locator("textarea[placeholder*='先写草稿']").count() > 0
        selfcheck_count = drawer.locator(".t2-self-checks button").count()
        has_etype = drawer.locator("select:has(option[value='artifact'])").count() > 0
        has_url = drawer.locator("input[placeholder*='链接']").count() > 0
        check("10. 抽屉含活动笔记", has_notes)
        check("11. 抽屉含自检", selfcheck_count == 3, f"自检按钮={selfcheck_count}")
        check("12. 抽屉含证据类型选择", has_etype)
        check("13. 抽屉含外部链接输入", has_url)
        page.screenshot(path=str(SHOTS / "04-drawer-inprogress.png"))
        # 步骤勾选第一个 + 自检全勾 + 笔记
        page.locator(".t2-step-checklist input[type=checkbox]").first.check()
        for btn in page.locator(".t2-self-checks button").all():
            btn.click()
        page.fill("textarea[placeholder*='先写草稿']", "今天理解了 LLM 的基本工作原理。")
        page.fill(
            "textarea[placeholder*='写下最终证据']",
            "语言模型不是存储事实的数据库，而是从训练数据中学到统计规律：训练阶段调整参数最小化预测误差，"
            "推理阶段根据上文逐词预测下一个 token。流畅自信的输出不等于正确，幻觉来自概率采样和高频模式，"
            "泛化能力依赖训练数据的分布与规模。判断 AI 应用方案是否靠谱，关键看三点：它把什么任务委托给模型、"
            "模型输出如何被校验、失败时的兜底机制是什么。",
        )
        page.click("button:has-text('提交证据')")
        page.wait_for_selector("button:has-text('评估证据')", timeout=15000)
        page.click("button:has-text('评估证据')")
        page.wait_for_selector(".t2-done", timeout=20000)
        check("14. 足量证据评估通过，活动完成", True)
        page.screenshot(path=str(SHOTS / "05-accepted.png"))
        page.click(".t2-close")

        # ── 6. 成长页：节点状态 / 中文 / 相邻分支 ──────
        page.goto(f"{BASE}/grow")
        page.wait_for_selector(".t2-treemap")
        validated = page.locator(".t2-node-dot.st-validated").count()
        growing = page.locator(".t2-node-dot.st-growing").count()
        check("15. 成长页节点已验证（证据驱动）", validated >= 1, f"validated={validated}, growing={growing}")
        node_titles = page.locator(".t2-node-card b").all_inner_texts()
        chinese_titles = [t for t in node_titles if any("\u4e00" <= c <= "\u9fff" for c in t)]
        check("16. 节点中文显示", len(chinese_titles) >= 1, f"示例={chinese_titles[:3]}")
        adj_count = page.locator(".t2-map-adjacent em").count()
        check("17. 相邻分支可见", adj_count >= 1, f"相邻分支={adj_count}")
        page.screenshot(path=str(SHOTS / "06-grow.png"))
        # 点开已验证节点详情，确认支持证据
        if validated >= 1:
            page.locator(".t2-node-card:has(.st-validated)").first.click()
            page.wait_for_selector(".t2-node-detail")
            support_text = page.locator(".t2-node-detail-row:has-text('支持证据') b").inner_text()
            check("18. 节点详情支持证据 ≥1 条", support_text.strip() != "0 条", f"支持证据={support_text}")
            page.screenshot(path=str(SHOTS / "07-node-detail.png"))

        # ── 7. 回学习页，重排前快照 ────────────────────
        page.goto(f"{BASE}/learn")
        page.wait_for_selector(".t2-week-board")
        before = api_get("/api/learning/workspace")["workspace"]
        before_evidence = sorted((e["id"], e["content"]) for e in before["evidence"])
        before_nodes = {p["nodeId"]: (p["status"], tuple(sorted(p["supportingEvidenceIds"])))
                        for p in before["nodeProgress"]}
        before_activities = {a["id"]: a for a in before["activities"]}
        before_ev_activity_ids = {e["activityId"] for e in before["evidence"]}
        before_core_planned = {aid for aid, a in before_activities.items()
                               if a["status"] in ("planned", "in_progress") and aid not in before_ev_activity_ids}
        ui_before_count = page.locator(".t2-activity-card").count()
        check("19. 重排前存在未产生证据的开放活动（将被替换）", len(before_core_planned) > 0,
              f"待替换活动数={len(before_core_planned)}")

        # ── 8. 点「重排本周」──────────────────────────
        page.click("button:has-text('重排本周')")
        page.wait_for_selector(".t2-adjust:has-text('activity_replan')", timeout=25000)
        check("20. 重排本周触发，调整记录出现 activity_replan", True)
        page.wait_for_selector(".t2-week-board")
        page.screenshot(path=str(SHOTS / "08-replanned.png"))

        # ── 9. 重排后验证 ─────────────────────────────
        after = api_get("/api/learning/workspace")["workspace"]
        # 9a. 已提交证据保留（id+内容完全一致）
        after_evidence = sorted((e["id"], e["content"]) for e in after["evidence"])
        check("21. 已提交证据保留", after_evidence == before_evidence,
              f"before={len(before_evidence)}, after={len(after_evidence)}")
        # 9b. 已验证节点状态保留
        after_nodes = {p["nodeId"]: (p["status"], tuple(sorted(p["supportingEvidenceIds"])))
                       for p in after["nodeProgress"]}
        validated_before = {nid: st for nid, (st, _) in before_nodes.items() if st == "validated"}
        validated_kept = all(after_nodes.get(nid, ("",))[0] == "validated" for nid in validated_before)
        evidence_ids_kept = all(after_nodes.get(nid, ("", ()))[1] == evids
                                for nid, (_, evids) in before_nodes.items() if evids)
        check("22. 已验证节点状态保留", validated_kept, f"validated 节点={list(validated_before.keys())}")
        check("23. 节点支持证据列表保留", evidence_ids_kept)
        # 9c. 有证据的活动保留（completed/reviewed 或带证据）
        after_activities = {a["id"]: a for a in after["activities"]}
        kept_ids = set(before_ev_activity_ids) & set(after_activities.keys())
        check("24. 已产生证据的活动保留", set(before_ev_activity_ids) <= set(after_activities.keys()),
              f"保留={len(kept_ids)}")
        # 9d. 本周看板出现新活动
        new_ids = set(after_activities.keys()) - set(before_activities.keys())
        check("25. 本周看板出现新活动", len(new_ids) > 0, f"新增活动={len(new_ids)}")
        ui_after_count = page.locator(".t2-activity-card").count()
        check("26. 看板活动数未减少（保留+新增）", ui_after_count >= ui_before_count,
              f"重排前={ui_before_count}, 重排后={ui_after_count}")
        # 9e. 未产生证据的开放活动被替换
        replaced = before_core_planned - set(after_activities.keys())
        check("27. 未产生证据的开放活动被替换", len(replaced) == len(before_core_planned),
              f"待替换={len(before_core_planned)}, 已移除={len(replaced)}")
        # 9f. 用户状态未清空（仍在视图 3，profile 还在）
        profile_kept = after.get("profile") is not None and after["profile"].get("status") == "confirmed"
        board_visible = page.locator(".t2-week-board").count() > 0
        check("28. 用户状态未清空（仍在周计划视图）", profile_kept and board_visible)
        # 9g. 调整记录 UI 可见
        check("29. 调整记录区显示 activity_replan", page.locator(".t2-adjust:has-text('activity_replan')").count() >= 1)
        # 9h. 补验：重排后（有状态）两个入口仍然可见
        replan_btn = page.locator("button:has-text('重排本周')").count()
        reset_btn = page.locator(".t2-reset-btn:has-text('重新设置')").count()
        check("30. 有状态时「重排本周」入口可见（补验）", replan_btn == 1, f"replan_btn={replan_btn}")
        check("31. 有状态时「重新设置」入口可见（补验）", reset_btn == 1, f"reset_btn={reset_btn}")

        # ── 10. 无 JS 错误 ────────────────────────────
        check("32. 无页面 JS 错误", len(errors) == 0, f"errors={errors[:3]}")
        browser.close()

    print()
    failed = [r for r in results if not r[1]]
    print(f"=== 重排本周验收：{len(results) - len(failed)}/{len(results)} 通过 ===")
    if failed:
        print("失败项:")
        for name, _, detail in failed:
            print(f"  ✗ {name}{' — ' + detail if detail else ''}")
        sys.exit(1)

if __name__ == "__main__":
    main()
