"use client";

// 学习页（默认首页）：诊断 → 路线确认 → 本周计划与活动
import { useEffect, useState } from "react";
import Shell from "../_components/shell";
import {
  ACTIVITY_STATUS_TEXT,
  ACTIVITY_TYPE_TEXT,
  fetchWorkspace,
  postDiagnostic,
  confirmProposal,
  startActivity,
  submitEvidence,
  reviewEvidence,
  confirmAdjustment,
  resetLearner,
  replanCurrentWeek,
  type AssessmentResult,
  type Workspace,
  type WorkspaceActivity,
} from "../../lib/learning/frontend";

const WEEKLY_TIME_OPTIONS = [
  [180, "3 小时"],
  [300, "5 小时"],
  [360, "6 小时"],
  [480, "8 小时"],
  [720, "12 小时"],
  [900, "15 小时"],
  [1200, "20 小时"],
] as const;
const CUSTOM_TIME = "custom";

export default function LearnPage() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // 诊断表单
  const [goal, setGoal] = useState("");
  const [weeklyMinutes, setWeeklyMinutes] = useState(300); // 默认 5 小时
  const [timeMode, setTimeMode] = useState<"preset" | "custom">("preset");
  const [preference, setPreference] = useState<"breadth_first" | "build_first">("breadth_first");
  // 活动抽屉
  const [activeActivity, setActiveActivity] = useState<WorkspaceActivity | null>(null);
  const [evidenceDraft, setEvidenceDraft] = useState("");
  const [activityNote, setActivityNote] = useState("");
  const [evidenceType, setEvidenceType] = useState<"explanation" | "artifact" | "code" | "judgment" | "notes" | "external">("explanation");
  const [externalUrl, setExternalUrl] = useState("");
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});
  const [selfChecks, setSelfChecks] = useState<Record<string, boolean>>({});
  // 最近一次评估结果（展示 reasons/missing，让用户理解判断依据）
  const [lastAssessment, setLastAssessment] = useState<AssessmentResult | null>(null);

  useEffect(() => {
    let alive = true;
    fetchWorkspace()
      .then((next) => { if (alive) setWs(next); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "加载失败"); });
    return () => { alive = false; };
  }, []);

  async function run(action: () => Promise<Workspace>, successMessage?: string) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const next = await action();
      setWs(next);
      if (successMessage) setMessage(successMessage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  if (error && !ws) {
    return (
      <Shell>
        <div className="t2-center">
          <h1>暂时无法加载</h1>
          <p>{error}</p>
          <button className="t2-primary" onClick={() => window.location.reload()}>重试</button>
        </div>
      </Shell>
    );
  }
  if (!ws) {
    return (
      <Shell>
        <div className="t2-center">
          <b className="t2-loading">Trellis</b>
          <p>正在准备你的学习环境……</p>
        </div>
      </Shell>
    );
  }

  // ── 视图 1：未诊断 → 目标输入 ──────────────────────
  if (!ws.profile) {
    return (
      <Shell>
        <div className="t2-onboarding">
          <p className="t2-kicker">不是课程目录，而是由证据驱动的学习路径</p>
          <h1>知道你要去哪里，<br />也知道该从哪里开始。</h1>
          <p className="t2-lead">
            Trellis 先理解你的目标和每周可用时间，生成学习地图与首周计划。
            所有判断都能回到证据，所有调整都会留下记录。
          </p>
          <div className="t2-onboard-card">
            <span>01 · 学习诉求</span>
            <label>
              你希望学会后能完成什么？
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="例如：能独立完成一个 AI 知识问答应用的方案与实现"
              />
            </label>
            <div className="t2-form-row">
              <label>
                每周可用时间
                <select
                  value={timeMode === "custom" ? CUSTOM_TIME : weeklyMinutes}
                  onChange={(e) => {
                    if (e.target.value === CUSTOM_TIME) {
                      setTimeMode("custom");
                    } else {
                      setWeeklyMinutes(Number(e.target.value));
                      setTimeMode("preset");
                    }
                  }}
                >
                  {WEEKLY_TIME_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                  <option value={CUSTOM_TIME}>自定义</option>
                </select>
                {timeMode === "custom" && (
                  <input
                    type="number"
                    min={1}
                    max={20}
                    placeholder="1–20 小时"
                    onChange={(e) => {
                      const hours = Number(e.target.value);
                      if (hours >= 1 && hours <= 20) setWeeklyMinutes(hours * 60);
                    }}
                  />
                )}
              </label>
              <label>
                优先方向
                <select value={preference} onChange={(e) => setPreference(e.target.value as never)}>
                  <option value="breadth_first">先建立全局认知</option>
                  <option value="build_first">尽快做出产出</option>
                </select>
              </label>
            </div>
            <button
              className="t2-primary"
              disabled={busy || !goal.trim()}
              onClick={() => void run(
                () => postDiagnostic({ goal, weeklyMinutes, preference }),
              )}
            >
              生成我的学习地图
            </button>
            {message && <p className="t2-message">{message}</p>}
            {error && <p className="t2-error">{error}</p>}
          </div>
        </div>
      </Shell>
    );
  }

  // ── 视图 2：已诊断未确认 → 路线提案 ─────────────────
  if (ws.profile.status !== "confirmed") {
    const firstNode = ws.nodeProgress[0];
    const growingCount = ws.nodeProgress.filter((p) => p.status !== "unstarted").length;
    return (
      <Shell>
        <div className="t2-topbar">
          <div>
            <p className="t2-kicker">学习地图提案</p>
            <h1>{ws.route?.title}</h1>
          </div>
          <span className="t2-muted">{ws.profile.weeklyMinutes} 分钟 / 周</span>
        </div>
        <div className="t2-proposal">
          <div className="t2-proposal-hero">
            <p className="t2-kicker">为什么从这里开始</p>
            <h2>{ws.route?.description}</h2>
            <div className="t2-proposal-meta">
              <span>地图节点 <b>{ws.nodeProgress.length}</b></span>
              <span>已有基础 <b>{growingCount}</b></span>
              <span>首个节点 <b>{firstNode ? firstNode.title : "—"}</b></span>
            </div>
            {ws.adjacentBranches.length > 0 && (
              <div className="t2-adjacent">
                <span>相邻分支：</span>
                {ws.adjacentBranches.map((b) => <em key={b.id}>{b.name}</em>)}
              </div>
            )}
          </div>
          <div className="t2-proposal-actions">
            <p className="t2-hint">确认后生成首周计划与具体学习活动；之后可在成长页随时调整。</p>
            <button
              className="t2-primary"
              disabled={busy}
              onClick={() => void run(() => confirmProposal(), "首周计划已生成")}
            >
              确认路线，生成首周计划
            </button>
            {error && <p className="t2-error">{error}</p>}
          </div>
        </div>
      </Shell>
    );
  }

  // ── 视图 3：已确认 → 本周计划 ───────────────────────
  const core = ws.activities.filter((a) => a.isCore);
  const optional = ws.activities.filter((a) => !a.isCore);
  const doneCount = core.filter((a) => a.status === "completed").length;
  const plannedMinutes = core.reduce((s, a) => s + a.estimatedMinutes, 0);
  const optionalMinutes = optional.reduce((s, a) => s + a.estimatedMinutes, 0);
  const capacityMinutes = ws.weeklyPlan?.capacityMinutes ?? ws.profile.weeklyMinutes;
  const remainingMinutes = Math.max(0, capacityMinutes - plannedMinutes);
  const completionPercent = core.length ? (doneCount / core.length) * 100 : 0;

  function openActivity(activity: WorkspaceActivity) {
    setActiveActivity(activity);
    setEvidenceDraft("");
    setActivityNote("");
    setExternalUrl("");
    setEvidenceType("explanation");
    setCheckedSteps({});
    setSelfChecks({});
    setLastAssessment(null);
  }

  return (
    <Shell>
      <div className="t2-topbar">
        <div>
          <p className="t2-kicker">学习 · 第 {ws.weeklyPlan?.weekKey.replace("2026-W", "") ?? "?"} 周</p>
          <h1>{ws.profile.goal}</h1>
        </div>
        <div className="t2-topbar-actions">
          <span className="t2-muted">核心承诺 {plannedMinutes} / {capacityMinutes} 分钟</span>
          <button
            className="t2-secondary"
            disabled={busy}
            onClick={() => {
              if (!window.confirm("重排本周会保留已产生的证据和节点进度，只替换未产生证据的开放活动。继续吗？")) return;
              void run(() => replanCurrentWeek({ weeklyMinutes: capacityMinutes }), "本周计划已重排，证据和成长状态已保留");
            }}
          >
            重排本周
          </button>
          <button
            className="t2-secondary t2-reset-btn"
            disabled={busy}
            onClick={() => {
              if (!window.confirm("重新设置将清空当前学习状态并回到初始诊断，确定继续？")) return;
              void run(() => resetLearner(), "已重置，请重新诊断");
            }}
          >
            重新设置
          </button>
        </div>
      </div>

      {message && <p className="t2-message">{message}</p>}
      {error && <p className="t2-error">{error}</p>}

      <div className="t2-week-hero">
        <div>
          <p className="t2-kicker">本周进度</p>
          <h2>{doneCount} / {core.length} 个核心活动完成</h2>
          <p>按需推进，不按日历切碎；只要本周完成核心承诺即可。普通完成只更新状态，不重排整周。</p>
        </div>
        <div className="t2-week-meter">
          <div className="t2-week-bar"><i style={{ width: `${completionPercent}%` }} /></div>
          <div className="t2-week-caps">
            <span><b>{Math.round(capacityMinutes / 60 * 10) / 10}h</b> 可用</span>
            <span><b>{Math.round(plannedMinutes / 60 * 10) / 10}h</b> 核心</span>
            <span><b>{Math.round(remainingMinutes / 60 * 10) / 10}h</b> 缓冲</span>
            <span><b>{Math.round(optionalMinutes / 60 * 10) / 10}h</b> 可选</span>
          </div>
        </div>
      </div>

      <section className="t2-section">
        <header>
          <h3>本周看板</h3>
          <span className="t2-muted">实心 = 核心承诺（按顺序推进）；描边 = 可选（缓冲，不计入承诺）。</span>
        </header>
        <div className="t2-week-board">
          {ws.activities.map((activity, index) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              nodeTitle={activity.title}
              order={index + 1}
              onOpen={() => openActivity(activity)}
            />
          ))}
          {ws.activities.length === 0 && <p className="t2-empty">本周暂无活动，先去成长页看看地图。</p>}
        </div>
      </section>

      <section className="t2-section">
        <header>
          <h3>调整记录</h3>
          <span className="t2-muted">路线变化均可追溯</span>
        </header>
        <div className="t2-adjust-list">
          {ws.adjustments.map((a) => (
            <div key={a.id} className={`t2-adjust ${a.status === "proposed" ? "proposed" : ""}`}>
              <b>{a.adjustmentType}</b>
              <p>{a.summary}</p>
              <div className="t2-adjust-meta">
                <em>{a.status === "proposed" ? "待确认" : a.status === "accepted" ? "已确认" : a.status}</em>
                {a.status === "proposed" && (
                  <button
                    className="t2-mini"
                    disabled={busy}
                    onClick={() => void run(() => confirmAdjustment(a.id), "调整已确认")}
                  >
                    确认
                  </button>
                )}
              </div>
            </div>
          ))}
          {ws.adjustments.length === 0 && <p className="t2-empty">暂无调整记录。</p>}
        </div>
      </section>

      {/* 活动抽屉：开始 / 提交证据 / 评估 */}
      {activeActivity && (
        <div className="t2-drawer-backdrop" onClick={() => setActiveActivity(null)}>
          <div className="t2-drawer" onClick={(e) => e.stopPropagation()}>
            <header>
              <div>
                <p className="t2-kicker">
                  {ACTIVITY_TYPE_TEXT[activeActivity.activityType]} · {activeActivity.estimatedMinutes} 分钟
                  {activeActivity.isSkipValidation && " · 跳学验证"}
                </p>
                <h2>{activeActivity.title}</h2>
                <p className="t2-goal">{activeActivity.goal}</p>
              </div>
              <button className="t2-close" onClick={() => setActiveActivity(null)}>×</button>
            </header>

            <div className="t2-drawer-body">
              {/* 为什么学：节点位置与前后关系 */}
              <section>
                <span className="t2-drawer-label">为什么学</span>
                <p className="t2-goal">{activeActivity.goal}</p>
                <div className="t2-node-rel">
                  <em>对应节点：{activeActivity.nodeId.replace(/^ai-literacy\./, "")}</em>
                  {(() => {
                    const prereqs = ws.edges
                      .filter((e) => e.relationType === "prerequisite" && e.targetNodeId === activeActivity.nodeId)
                      .map((e) => ws.nodeProgress.find((p) => p.nodeId === e.sourceNodeId)?.title ?? e.sourceNodeId);
                    const nexts = ws.edges
                      .filter((e) => e.relationType === "prerequisite" && e.sourceNodeId === activeActivity.nodeId)
                      .map((e) => ws.nodeProgress.find((p) => p.nodeId === e.targetNodeId)?.title ?? e.targetNodeId);
                    return (
                      <>
                        {prereqs.length > 0 && <em>前置：{prereqs.join("、")}</em>}
                        {nexts.length > 0 && <em>完成后可进入：{nexts.join("、")}</em>}
                      </>
                    );
                  })()}
                </div>
              </section>

              {/* 学什么：关联材料资源卡（可点击） */}
              {(() => {
                const refs = ws.workbench.resources.filter((r) => activeActivity.inputRefs.includes(r.resourceId));
                if (refs.length === 0) return null;
                return (
                  <section>
                    <span className="t2-drawer-label">学什么 · 关联材料</span>
                    <div className="t2-resource-links">
                      {refs.map((r) => (
                        <a key={r.resourceId} href={r.url} target="_blank" rel="noreferrer" className="t2-resource-link">
                          {r.title}
                          <small>{r.usage}</small>
                        </a>
                      ))}
                    </div>
                  </section>
                );
              })()}

              <section>
                <span className="t2-drawer-label">操作步骤</span>
                <div className="t2-step-checklist">
                  {activeActivity.steps.split("\n").filter(Boolean).map((step, i) => (
                    <label key={i} className={checkedSteps[i] ? "checked" : ""}>
                      <input
                        type="checkbox"
                        checked={Boolean(checkedSteps[i])}
                        onChange={(e) => setCheckedSteps((prev) => ({ ...prev, [i]: e.target.checked }))}
                      />
                      <span>{step}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section>
                <span className="t2-drawer-label">产出证据</span>
                <p className="t2-muted">{activeActivity.expectedEvidence}</p>
                <span className="t2-drawer-label">评估标准</span>
                <p className="t2-muted">{activeActivity.evaluationCriteria}</p>
              </section>

              {activeActivity.status === "planned" && (
                <button
                  className="t2-primary"
                  disabled={busy}
                  onClick={() => void run(
                    () => startActivity(activeActivity.id).then((next) => {
                      setActiveActivity(next.activities.find((a) => a.id === activeActivity.id) ?? null);
                      return next;
                    }),
                  )}
                >
                  开始这个活动
                </button>
              )}

              {(activeActivity.status === "in_progress") && (
                <section className="t2-evidence-form">
                  <span className="t2-drawer-label">活动笔记</span>
                  <textarea
                    value={activityNote}
                    onChange={(e) => setActivityNote(e.target.value)}
                    placeholder="先写草稿：我理解了什么？哪里不确定？用了哪个材料或工具？"
                  />
                  <div className="t2-self-checks">
                    {[
                      ["explain", "我能用自己的话解释这个节点"],
                      ["boundary", "我知道它适用/不适用的边界"],
                      ["artifact", "我留下了可复核的产出或判断"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={selfChecks[key] ? "active" : ""}
                        onClick={() => setSelfChecks((prev) => ({ ...prev, [key]: !prev[key] }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <span className="t2-drawer-label">提交你的证据</span>
                  <div className="t2-evidence-meta">
                    <label>
                      证据类型
                      <select value={evidenceType} onChange={(e) => setEvidenceType(e.target.value as typeof evidenceType)}>
                        <option value="explanation">解释</option>
                        <option value="artifact">作品/产出</option>
                        <option value="code">代码</option>
                        <option value="judgment">判断</option>
                        <option value="notes">笔记</option>
                        <option value="external">外部链接</option>
                      </select>
                    </label>
                    <label>
                      外部链接（可选）
                      <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="作品、文档、代码或材料链接" />
                    </label>
                  </div>
                  <textarea
                    value={evidenceDraft}
                    onChange={(e) => setEvidenceDraft(e.target.value)}
                    placeholder="写下最终证据：解释、判断、作品摘要、代码说明或学习笔记……"
                  />
                  <button
                    className="t2-primary"
                    disabled={busy || !evidenceDraft.trim()}
                    onClick={() => void run(
                      () => submitEvidence(activeActivity.id, {
                        evidenceType,
                        externalUrl: externalUrl.trim(),
                        content: [
                          activityNote.trim() ? `活动笔记：${activityNote.trim()}` : "",
                          `自检：${Object.values(selfChecks).filter(Boolean).length}/3`,
                          `证据：${evidenceDraft.trim()}`,
                        ].filter(Boolean).join("\n\n"),
                      }).then((next) => {
                        setLastAssessment(null);
                        setActiveActivity(next.activities.find((a) => a.id === activeActivity.id) ?? null);
                        return next;
                      }),
                      "证据已提交，等待评估",
                    )}
                  >
                    提交证据
                  </button>
                </section>
              )}

              {activeActivity.status === "evidence_submitted" && (
                <div className="t2-pending">
                  <p>证据已提交，等待评估。</p>
                  <button
                    className="t2-primary"
                    disabled={busy}
                    onClick={() => {
                      const evidence = ws.evidence.find((e) => e.activityId === activeActivity.id && e.status === "submitted");
                      if (!evidence) return;
                      void run(async () => {
                        const result = await reviewEvidence(evidence.id);
                        setLastAssessment(result.assessment);
                        setActiveActivity(result.workspace.activities.find((a) => a.id === activeActivity.id) ?? null);
                        return result.workspace;
                      });
                    }}
                  >
                    评估证据
                  </button>
                </div>
              )}

              {/* 评估结果：让用户理解判断依据 */}
              {lastAssessment && (
                <section className="t2-assessment">
                  <span className="t2-drawer-label">
                    评估结果：{lastAssessment.verdict === "accepted" ? "已接受" : "需修订"}
                  </span>
                  {lastAssessment.reasons.length > 0 && (
                    <ul className="t2-assessment-list">
                      {lastAssessment.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  )}
                  {lastAssessment.missing.length > 0 && (
                    <div className="t2-assessment-missing">
                      <b>未满足：</b>
                      <ul>{lastAssessment.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
                    </div>
                  )}
                  {lastAssessment.verdict === "needs_revision" && (
                    <p className="t2-hint">
                      建议熟练等级 {lastAssessment.suggestedLevel}。请按反馈修订证据后重新提交，
                      或回到活动重新学习。
                    </p>
                  )}
                </section>
              )}

              {(activeActivity.status === "reviewed" || activeActivity.status === "completed") && (
                <div className="t2-done">
                  <b>✓ 活动已完成</b>
                  <p className="t2-muted">{activeActivity.nextAdvice}</p>
                  {activeActivity.isSkipValidation && (
                    <p className="t2-hint">跳学验证通过，节点进入已验证。</p>
                  )}
                </div>
              )}

              <p className="t2-status-line">
                当前状态：<b>{ACTIVITY_STATUS_TEXT[activeActivity.status]}</b>
              </p>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function ActivityCard({
  activity,
  nodeTitle,
  order,
  onOpen,
}: {
  activity: WorkspaceActivity;
  nodeTitle: string;
  order?: number;
  onOpen: () => void;
}) {
  const evidence = null; // 卡片上不展示证据详情，抽屉内展示
  return (
    <article className={`t2-activity-card ${activity.isCore ? "core" : "optional"} ${activity.status === "completed" ? "done" : ""}`}>
      <div className="t2-activity-main" onClick={onOpen}>
        <div className="t2-activity-head">
          <span>{order ? `#${order} · ` : ""}{ACTIVITY_TYPE_TEXT[activity.activityType]}{activity.isSkipValidation ? " · 跳学验证" : ""}</span>
          <em>{activity.estimatedMinutes} 分钟{!activity.isCore ? " · 可选" : ""}</em>
        </div>
        <h4>{nodeTitle}</h4>
        <p>{activity.goal}</p>
        <footer>
          <span>{ACTIVITY_STATUS_TEXT[activity.status]}</span>
          <span>证据：{activity.expectedEvidence}</span>
        </footer>
      </div>
      {evidence}
    </article>
  );
}
