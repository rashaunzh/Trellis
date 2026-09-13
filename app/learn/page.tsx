"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { activityProgramUnits } from "../../lib/learning/intelligence/program-bindings";
import { routeReviewSummary } from "../../lib/learning/intelligence/route-review";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Layers3,
  Link2,
  Map,
  Paperclip,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Shell from "../_components/shell";
import {
  analyzeCourseMaterial,
  closeLearningWeek,
  confirmCurriculum,
  confirmLearningWeek,
  createCurriculum,
  fetchCourseIntelligenceState,
  fetchCurrentLearning,
  fetchLearningOrchestration,
  fetchLearningTaskResult,
  fetchScenarioCheck,
  pauseLearningActivity,
  recordLearningSignal,
  rejectCurriculumDecision,
  getOwnerId,
  reviseCurriculum,
  startLearningActivity,
  updateLearningLocation,
  type CourseIntelligenceState,
  type CurriculumConstraint,
  type CurriculumRecord,
  type CurrentLearningState,
  type LearningOrchestrationState,
  type LearningTaskResult,
  type LearningIntake,
  type MaterialAnalysisResult,
  type PublicScenarioCheck,
} from "../../lib/learning/frontend";

type Material = LearningIntake["materials"][number];
type OrchestrationTask = NonNullable<LearningOrchestrationState["weeklyPackage"]>["tasks"][number];
type FeedbackSummaryData = {
  interpretation?: { outcome?: string; rationale?: string; keepsActivityOpen?: boolean };
  nextAction?: string;
  materializedAdaptation?: { summary?: string; applied?: boolean };
};
const emptyMaterial = (): Material => ({ title: "", url: "", outline: "" });
const capacityOptions = [
  ["light", "每周约 2 小时"],
  ["steady", "每周约 3-4 小时"],
  ["focused", "每周约 5-6 小时"],
  ["intensive", "每周 7 小时以上"],
] as const;
const roleText = {
  anchor: "主线",
  selected_units: "选定章节",
  supplement: "补充",
  defer: "后续",
  exclude: "暂不采用",
} as const;

function courseOf(state: CourseIntelligenceState, id: string) {
  return state.catalog.find((course) => course.id === id);
}

export default function LearnPage() {
  const [state, setState] = useState<CourseIntelligenceState | null>(null);
  const [current, setCurrent] = useState<CurrentLearningState | null>(null);
  const [orchestration, setOrchestration] = useState<LearningOrchestrationState | null>(null);
  const [goal, setGoal] = useState("");
  const [weeklyCapacity, setWeeklyCapacity] = useState<LearningIntake["weeklyCapacity"]>("steady");
  const [materials, setMaterials] = useState<Material[]>([emptyMaterial()]);
  const [analyses, setAnalyses] = useState<Record<number, MaterialAnalysisResult>>({});
  const [editing, setEditing] = useState(false);
  const [viewConfirmed, setViewConfirmed] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummaryData | null>(null);
  const [taskResult, setTaskResult] = useState<LearningTaskResult | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [routeOpen, setRouteOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<"understood" | "uncertain" | "blocked">("understood");
  const [quiz, setQuiz] = useState<"not_taken" | "passed" | "failed">("not_taken");
  const [completionIntent, setCompletionIntent] = useState<"auto" | "complete" | "keep_open">("auto");
  const [actualMinutes, setActualMinutes] = useState(30);
  const [note, setNote] = useState("");
  const [scenario, setScenario] = useState<PublicScenarioCheck | null>(null);
  const [scenarioChoice, setScenarioChoice] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [locatorLabel, setLocatorLabel] = useState("");
  const [intakeRestored, setIntakeRestored] = useState(false);
  const generation = useRef<AbortController | null>(null);

  useEffect(() => {
    let saved: { goal?: string; weeklyCapacity?: LearningIntake["weeklyCapacity"]; materials?: Material[] } = {};
    try { saved = JSON.parse(sessionStorage.getItem(`trellis.intake.${getOwnerId()}`) ?? "{}") ?? {}; } catch { /* 无有效草稿 */ }
    queueMicrotask(() => {
      if (typeof saved.goal === "string") setGoal(saved.goal);
      if (capacityOptions.some(([value]) => value === saved.weeklyCapacity)) setWeeklyCapacity(saved.weeklyCapacity!);
      if (Array.isArray(saved.materials) && saved.materials.every(item => item && typeof item.title === "string" && typeof item.url === "string" && typeof item.outline === "string")) setMaterials(saved.materials.slice(0, 8));
      setIntakeRestored(true);
    });
    return () => generation.current?.abort();
  }, []);
  useEffect(() => {
    if (!intakeRestored) return;
    try { sessionStorage.setItem(`trellis.intake.${getOwnerId()}`, JSON.stringify({ goal, weeklyCapacity, materials })); } catch { /* 不阻止正常学习 */ }
  }, [goal, weeklyCapacity, materials, intakeRestored]);

  function cancelGeneration() {
    generation.current?.abort();
    generation.current = null;
    setBusy("");
    setMessage("已停止等待，输入已保留；后台即使完成，也只产生待确认草稿。");
  }

  async function refresh() {
    const [nextState, nextCurrent, nextOrchestration] = await Promise.all([
      fetchCourseIntelligenceState(),
      fetchCurrentLearning().catch(() => null),
      fetchLearningOrchestration().catch(() => null),
    ]);
    setState(nextState);
    setCurrent(nextCurrent);
    setOrchestration(nextOrchestration);
  }

  useEffect(() => {
    let alive = true;
    Promise.all([fetchCourseIntelligenceState(), fetchCurrentLearning().catch(() => null), fetchLearningOrchestration().catch(() => null)])
      .then(([nextState, nextCurrent, nextOrchestration]) => {
        if (alive) {
          setState(nextState);
          setCurrent(nextCurrent);
          setOrchestration(nextOrchestration);
        }
      })
      .catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "学习状态加载失败"); });
    return () => { alive = false; };
  }, []);

  const curriculum = viewConfirmed && current?.curriculum?.status === "confirmed" ? current.curriculum : state?.curriculum ?? null;
  const active = curriculum?.assembly.decisions.filter((decision) =>
    ["anchor", "selected_units", "supplement"].includes(decision.role)) ?? [];
  const currentActivity = useMemo(() => {
    if (!current) return null;
    const resumeId = current.resumeState.activityId;
    return current.activities.find((activity) => activity.id === resumeId)
      ?? current.activities.find((activity) => activity.status !== "completed")
      ?? null;
  }, [current]);
  const completed = current?.activities.filter((activity) => activity.status === "completed").length ?? 0;
  const total = current?.activities.length ?? 0;
  const showIntake = !curriculum || editing;

  function updateMaterial(index: number, field: keyof Material, value: string) {
    setMaterials((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  async function analyze(index: number) {
    setBusy(`analyze-${index}`);
    setError("");
    try {
      const result = await analyzeCourseMaterial(materials[index]!);
      setAnalyses((items) => ({ ...items, [index]: result }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "课程判断失败");
    } finally {
      setBusy("");
    }
  }

  async function submitIntake() {
    if (!goal.trim() || generation.current) return;
    const controller = new AbortController();
    generation.current = controller;
    setBusy("intake");
    setError("");
    try {
      const provided = materials.filter((item) => item.title.trim() || item.url.trim() || item.outline.trim());
      await createCurriculum({ goal: goal.trim(), weeklyCapacity, materials: provided }, controller.signal);
      if (controller.signal.aborted) return;
      setViewConfirmed(false);
      setEditing(false);
      await refresh();
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "课程方案生成失败");
    } finally {
      if (generation.current === controller) { generation.current = null; setBusy(""); }
    }
  }

  async function revise(constraints: CurriculumConstraint[]) {
    if (!curriculum) return;
    setBusy("revise");
    setError("");
    try {
      await reviseCurriculum(curriculum.id, constraints);
      setViewConfirmed(false);
      await refresh();
      setMessage("已生成新的方案版本，原方案和学习记录仍保留。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "方案调整失败");
    } finally {
      setBusy("");
    }
  }

  async function keepCurrentRoute() {
    const decision = current?.pendingDecisions.find(item => item.aggregateType === "curriculum" && item.aggregateId === state?.curriculum?.id);
    if (!decision) return;
    setBusy("reject");
    try {
      await rejectCurriculumDecision(decision.id);
      await refresh();
      setViewConfirmed(false);
      setMessage("已保留当前路线，未应用这次调整。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "暂时无法保存取舍"); }
    finally { setBusy(""); }
  }

  async function confirm(record: CurriculumRecord) {
    setBusy("confirm");
    setError("");
    try {
      await confirmCurriculum(record.id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "方案激活失败");
    } finally {
      setBusy("");
    }
  }

  function editRouteInput(record: CurriculumRecord) {
    setGoal(record.intake.goal);
    setWeeklyCapacity(record.intake.weeklyCapacity);
    setMaterials(record.intake.materials.length ? record.intake.materials.map(item => ({ ...item })) : [emptyMaterial()]);
    setAnalyses({});
    setEditing(true);
  }

  async function startCurrent() {
    if (!currentActivity) return;
    setBusy("start");
    try {
      const result = await startLearningActivity(currentActivity.id);
      await refresh();
      if (result.sourceResolution.url) window.open(result.sourceResolution.url, "_blank", "noopener,noreferrer");
      else setLocationOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "当前片段无法开始");
    } finally {
      setBusy("");
    }
  }

  async function pauseCurrent() {
    if (!currentActivity) return;
    setBusy("pause");
    try {
      await pauseLearningActivity(currentActivity.id, "稍后继续");
      await refresh();
    } finally {
      setBusy("");
    }
  }

  async function saveLocation() {
    if (!currentActivity || !sourceUrl.trim()) return;
    setBusy("location");
    try {
      await updateLearningLocation(currentActivity.id, { sourceUrl: sourceUrl.trim(), locatorLabel: locatorLabel.trim() });
      await refresh();
      setLocationOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "位置保存失败");
    } finally {
      setBusy("");
    }
  }

  async function submitFeedback() {
    if (!currentActivity) return;
    setBusy("feedback");
    setError("");
    try {
      let result: FeedbackSummaryData;
      if (scenario && scenarioChoice) {
        result = await recordLearningSignal(currentActivity.id, {
          expectedSignalId: currentActivity.scope?.lastFeedbackSignalId ?? null,
          type: "scenario_choice",
          understanding: feedback,
          value: scenarioChoice,
          note,
          questionId: scenario.id,
          actualMinutes,
          completionIntent,
        }) as FeedbackSummaryData;
      } else if (quiz !== "not_taken") {
        result = await recordLearningSignal(currentActivity.id, {
          expectedSignalId: currentActivity.scope?.lastFeedbackSignalId ?? null,
          type: "quiz_result",
          understanding: feedback,
          value: quiz === "passed" ? 100 : 50,
          note,
          actualMinutes,
          completionIntent,
        }) as FeedbackSummaryData;
      } else {
        result = await recordLearningSignal(currentActivity.id, {
          expectedSignalId: currentActivity.scope?.lastFeedbackSignalId ?? null,
          type: feedback === "blocked" ? "stuck" : "understanding",
          understanding: feedback,
          value: feedback,
          note,
          actualMinutes,
          completionIntent,
        }) as FeedbackSummaryData;
      }
      setFeedbackSummary(result);
      setTaskResult(null);
      setScenario(null);
      setScenarioChoice("");
      setNote("");
      await refresh();
      try {
        setTaskResult(await fetchLearningTaskResult(currentActivity.id));
      } catch {
        // The immediate response remains available if the persisted projection is briefly unavailable.
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "学习反馈保存失败");
    } finally {
      setBusy("");
    }
  }

  async function loadScenario() {
    if (!currentActivity) return;
    setBusy("scenario");
    try {
      setScenario(await fetchScenarioCheck(currentActivity.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "情景判断暂时不可用");
    } finally {
      setBusy("");
    }
  }

  if (!state) return <Shell><div className="t2-center"><b>正在恢复你的学习状态…</b>{error && <p>{error}</p>}</div></Shell>;

  return (
    <Shell>
      <div className="cl-page">
        <header className="cl-page-head">
          <div>
            <span className="t2-kicker">LEARNING ROUTE</span>
            <h1>{showIntake
              ? "让已有材料，成为清晰路线"
              : curriculum?.status === "confirmed"
                ? orchestration?.weeklyPackage?.mission ?? current?.routeSummary?.currentStageTitle ?? "当前学习任务包"
                : "审阅路线与第一步"}</h1>
            {!showIntake && <p>{curriculum?.status === "confirmed" ? orchestration?.situation.goalHypothesis ?? curriculum.intake.goal : curriculum?.intake.goal}</p>}
          </div>
          {!showIntake && (
            <div className="cl-head-actions">
              <button className="cl-icon-button" title="路线管理" aria-label="路线管理" onClick={() => setRouteOpen(true)}><SlidersHorizontal size={18} /></button>
              <button className="cl-icon-button" title="重新说明目标" aria-label="重新说明目标" onClick={() => setEditing(true)}><RotateCcw size={18} /></button>
            </div>
          )}
        </header>
        {state.curriculum?.status === "draft" && current?.curriculum?.status === "confirmed" && <div className="cl-toast"><span>新路线等待确认，当前学习仍可继续。</span><button onClick={() => setViewConfirmed(value => !value)}>{viewConfirmed ? "查看新路线" : "继续当前路线"}</button><button disabled={Boolean(busy)} onClick={keepCurrentRoute}>保留当前路线</button></div>}
        {error && <div className="cl-toast cl-error">{error}<button aria-label="关闭" onClick={() => setError("")}><X size={16} /></button></div>}
        {message && <div className="cl-toast">{message}<button aria-label="关闭" onClick={() => setMessage("")}><X size={16} /></button></div>}

        {showIntake ? (
          <IntakeView
            goal={goal}
            setGoal={setGoal}
            weeklyCapacity={weeklyCapacity}
            setWeeklyCapacity={setWeeklyCapacity}
            materials={materials}
            analyses={analyses}
            busy={busy}
            updateMaterial={updateMaterial}
            analyze={analyze}
            addMaterial={() => setMaterials((items) => items.length < 8 ? [...items, emptyMaterial()] : items)}
            removeMaterial={(index) => setMaterials((items) => items.filter((_, itemIndex) => itemIndex !== index))}
            submit={submitIntake}
            cancel={busy === "intake" ? cancelGeneration : curriculum ? () => setEditing(false) : undefined}
          />
        ) : curriculum?.status !== "confirmed" ? (
          <ProposalView key={curriculum!.id} state={state} curriculum={curriculum!} busy={busy} revise={revise} confirm={confirm} editInput={() => editRouteInput(curriculum!)} />
        ) : (
          <section className="cl-dashboard">
            {routeReviewSummary(curriculum.assembly, state.graph.nodes).limited && <section className="cl-route-coverage" aria-label="当前路线覆盖限制"><h2>当前执行的是部分路线</h2><p>已完成记录继续保留，以下目标仍未安排：{routeReviewSummary(curriculum.assembly, state.graph.nodes).missing.join("、") || "见路线管理中的材料与前置缺口"}。</p><button onClick={() => editRouteInput(curriculum)}>补充材料或修改目标</button><button onClick={() => setRouteOpen(true)}>查看当前取舍</button></section>}
            <div className="cl-status-row">
              <div><small>当前处境</small><strong>{entryModeLabel(orchestration?.situation.entryMode)}</strong></div>
              <div><small>本周任务</small><strong>{completed}/{total}</strong></div>
              <div><small>最近学习</small><strong>{formatRelative(current?.resumeState.lastOpenedAt)}</strong></div>
              <div><small>本周时间</small><strong>{orchestration?.situation.weeklyMinutes ?? current?.weeklyPlan?.capacityMinutes ?? 0} 分钟</strong></div>
            </div>

            {current?.routeManagementSummary && (
              <section className="cl-route-strip">
                <button type="button" onClick={() => setRouteOpen(true)}>
                  <SlidersHorizontal size={16} />
                  <span>路线管理</span>
                </button>
                <div><small>已采用</small><strong>{current.routeManagementSummary.adoptedCount}</strong></div>
                <div><small>暂缓</small><strong>{current.routeManagementSummary.deferredCount}</strong></div>
                <div><small>排除</small><strong>{current.routeManagementSummary.excludedCount}</strong></div>
                <div><small>固定</small><strong>{current.routeManagementSummary.pinnedCount}</strong></div>
                <div><small>待确认版本</small><strong>{current.routeManagementSummary.pendingRevisionCount}</strong></div>
              </section>
            )}

            <section className="cl-mission-card">
              <div>
                <small>本周只做一件事</small>
                <h2>{orchestration?.weeklyPackage?.mission ?? "把当前目标转成可判断的学习进展"}</h2>
                <p>{orchestration?.weeklyPackage?.whyThisWeek ?? "系统会根据目标、起点、材料状态和反馈证据决定下一步。"}</p>
              </div>
              <strong>{orchestration?.weeklyPackage?.plannedMinutes ?? 0}<span>分钟任务包</span></strong>
            </section>

            {orchestration?.weeklyPackage && <section className="cl-week-contract">
              <div><small>本周完成标准</small>{orchestration.weeklyPackage.completionCriteria.slice(0, 3).map((item) => <p key={item}><Check size={14} />{item}</p>)}</div>
              <div><small>本周停止条件</small>{orchestration.weeklyPackage.stopConditions.slice(0, 3).map((item) => <p key={item}><span>•</span>{item}</p>)}</div>
            </section>}

            <section className="cl-course-overview">
              <div className="cl-section-title"><span><Layers3 size={17} />能力任务包</span><small>{orchestration?.weeklyPackage?.coreTaskIds.length ?? 0} 个核心 · {orchestration?.weeklyPackage?.optionalTaskIds.length ?? 0} 个可选</small></div>
              {orchestration?.weeklyPackage?.tasks.length ? (
                <div className="cl-task-package">
                  {orchestration.weeklyPackage.tasks.slice(0, 5).map((task, index) => (
                      <article key={task.id} className={task.id === orchestration.weeklyPackage?.currentTaskId ? "current" : ""}>
                        <i>{index + 1}</i>
                        <div>
                        <span>{task.isCore ? "核心任务" : "可选任务"} · {assessmentLabel(task.assessment)} · {task.estimatedMinutes} 分钟</span>
                        <strong>{task.title}</strong>
                        <p>{task.objective}</p>
                        <small>材料片段：{task.sourceFragments.map((item) => item.title).join("、") || "由任务生成"}</small>
                        {task.isCore && index > 0 && <small>顺序：完成上一个核心任务后再进入</small>}
                        <button className="cl-task-detail-button" type="button" onClick={() => setSelectedTaskId(task.id)}>查看任务契约 <ChevronRight size={14} /></button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
              <div className="cl-course-stack">
                {active.slice(0, 3).map((decision, index) => {
                  const course = courseOf(state, decision.courseId);
                  return <article key={decision.courseId} style={{ "--stack-index": index } as React.CSSProperties}>
                    <small>{roleText[decision.role]}</small><strong>{course?.title ?? decision.courseId}</strong>
                    <span>{decision.selectedUnitIds.length ? `${decision.selectedUnitIds.length} 个选定章节` : "按当前阶段采用"}</span>
                  </article>;
                })}
              </div>
              )}
            </section>

            {currentActivity ? (
              <section className="cl-current-card">
                <div className="cl-current-main">
                  <div className="cl-current-label"><span className="cl-live-dot" />{current?.resumeState.mode === "resume" || current?.resumeState.mode === "paused" ? "继续上次片段" : "当前片段"}</div>
                  <h2>{currentActivity.title}</h2>
                  <p className="cl-action-scope">{currentActivity.goal}</p>
                  {orchestration?.situation.nextBestMove && <p className="cl-resume-reason">{orchestration.situation.nextBestMove}</p>}
                  {current?.resumeState.reason && <p className="cl-resume-reason">{current.resumeState.reason}</p>}
                  <dl>
                    <div><dt>本次范围</dt><dd>{currentActivity.steps || "完成当前材料片段的核心部分"}</dd></div>
                    <div><dt>停止条件</dt><dd>{currentActivity.scope?.stopCondition || currentActivity.expectedEvidence}</dd></div>
                    <div><dt>出口检查</dt><dd>{assessmentLabel(orchestration?.weeklyPackage?.tasks.find((task) => task.id === currentActivity.id)?.assessment ?? "scenario")}</dd></div>
                  </dl>
                  <div className="cl-primary-actions">
                    <button className="cl-start-button" onClick={startCurrent} disabled={busy === "start"}><Play size={18} fill="currentColor" />{current?.resumeState.nextActionLabel ?? "开始这一节"}<ArrowUpRight size={17} /></button>
                    {currentActivity.status === "in_progress" && <button className="cl-quiet-button" onClick={pauseCurrent}><Pause size={17} />暂停</button>}
                    <button className="cl-quiet-button" onClick={() => setFeedbackOpen(true)}><Check size={17} />学习反馈</button>
                    {activityProgramUnits[currentActivity.canonicalNodeId ?? ""] && <Link className="cl-quiet-button" href={`/learn/activity/${encodeURIComponent(currentActivity.id)}`}>讲解与理解检查</Link>}
                  </div>
                </div>
                <aside className={`cl-source-note ${current?.sourceResolution?.kind ?? "missing"}`}>
                  <small>来源定位</small>
                  <em>{current?.sourceResolution?.precisionLabel ?? "缺少可打开位置"}</em>
                  <strong>{current?.sourceResolution?.locatorLabel || "尚未定位到章节"}</strong>
                  <p>{current?.sourceResolution?.guidance}</p>
                  {current?.sourceResolution?.manualOverride && <b>使用你补充的位置</b>}
                  {current?.sourceResolution?.kind !== "exact" && <button onClick={() => setLocationOpen(true)}><Map size={15} />补充准确位置</button>}
                </aside>
              </section>
            ) : <section className="cl-empty"><Check size={24} /><h2>本周片段已完成</h2><p>可以生成下一周提案，历史学习信号会继续保留。</p></section>}

            {currentActivity && current?.attachedResources.length ? (
              <section className="cl-attached-resources">
                <div className="cl-section-title"><span><Paperclip size={16} />当前片段参考</span><small>只辅助本节，不改变路线</small></div>
                <div>
                  {current.attachedResources.slice(0, 3).map((resource) => (
                    <article key={resource.id}>
                      <span>{resource.type}</span>
                      <strong>{resource.title}</strong>
                      <p>{resource.content || "工作台附加内容"}</p>
                      {resource.sourceUrl && <a href={resource.sourceUrl} target="_blank" rel="noreferrer"><Link2 size={14} />打开</a>}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {current?.adaptationTimeline.length ? (
              <section className="cl-adaptation">
                <span>最近变化</span>
                <strong>{current.adaptationTimeline[0]?.changeSummary}</strong>
                <p>{current.adaptationTimeline[0]?.signalSummary}；{current.adaptationTimeline[0]?.applied ? "已应用到当前学习。" : "等待确认，当前路线未改变。"}</p>
                {current.adaptationTimeline.length > 1 && (
                  <details>
                    <summary>查看最近 {current.adaptationTimeline.length} 条变化</summary>
                    {current.adaptationTimeline.map((item) => (
                      <article key={item.id}>
                        <small>{formatRelative(item.createdAt)} · {item.applied ? "已应用" : "待确认"}</small>
                        <b>{item.signalSummary}</b>
                        <p>{item.changeSummary}</p>
                      </article>
                    ))}
                  </details>
                )}
              </section>
            ) : null}

            {orchestration?.decisionTrace.length ? (
              <details className="cl-decision-trace">
                <summary><span>为什么这样安排</span><small>查看 Trellis 的判断依据</small></summary>
                <div>{orchestration.decisionTrace.slice(0, 5).map((trace) => <article key={trace.id}><span>{trace.label}</span><strong>{trace.rationale}</strong><p>{trace.inputSummary}</p></article>)}</div>
              </details>
            ) : null}

            <section className="cl-lifecycle">
              <div className="cl-section-title"><span>连续进度</span><small>完成后才推进，不用打卡</small></div>
              <div className="cl-timeline">
                {(current?.activities ?? []).slice(0, 6).map((activity, index) => (
                  <article key={activity.id} className={activity.id === currentActivity?.id ? "current" : activity.status === "completed" ? "done" : "next"}>
                    <i>{activity.status === "completed" ? <Check size={14} /> : index + 1}</i>
                    <div><small>{activity.status === "completed" ? "已完成" : activity.id === currentActivity?.id ? "当前" : "接下来"}</small><strong>{activity.title}</strong><span>{activity.estimatedMinutes} 分钟</span></div>
                  </article>
                ))}
              </div>
            </section>

            <section className="cl-next-week">
              <div><small>下一周</small><h2>{current?.nextWeekProposal ? "方案已生成，等待你的确认" : "由本周信号自然生成"}</h2><p>未完成片段、反复卡点和必要前置会优先进入下一周。</p></div>
              {current?.nextWeekProposal
                ? <button onClick={async () => { await confirmLearningWeek(current.nextWeekProposal!.weekKey); await refresh(); }}>确认下一周</button>
                : current?.weeklyPlan && <button onClick={async () => { await closeLearningWeek(current.weeklyPlan!.weekKey); await refresh(); }}>生成提案</button>}
            </section>
          </section>
        )}
      </div>

      <Drawer open={routeOpen} close={() => setRouteOpen(false)} title="路线管理">
        {curriculum && <CurriculumDetails state={state} curriculum={curriculum} revise={revise} busy={busy} />}
      </Drawer>
      <Drawer open={locationOpen} close={() => setLocationOpen(false)} title="补充准确位置">
        <div className="cl-drawer-form"><p>保存你实际打开的章节、时间戳或页码。它只影响你的路线，不会修改共享课程。</p><label>章节链接<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" /></label><label>位置说明<input value={locatorLabel} onChange={(event) => setLocatorLabel(event.target.value)} placeholder="例如：Module 2 · 12:30-28:00" /></label><button className="cl-start-button" disabled={!sourceUrl.trim() || busy === "location"} onClick={saveLocation}>保存位置</button></div>
      </Drawer>
      <Drawer open={feedbackOpen} close={() => setFeedbackOpen(false)} title="留下学习反馈" wide>
        {taskResult ? <LearningTaskResultView result={taskResult} close={() => { setTaskResult(null); setFeedbackSummary(null); setFeedbackOpen(false); }} /> : feedbackSummary ? <FeedbackSummary summary={feedbackSummary} close={() => { setFeedbackSummary(null); setFeedbackOpen(false); }} /> : <FeedbackPanel
          activityTitle={currentActivity?.title ?? ""}
          feedback={feedback}
          setFeedback={setFeedback}
          quiz={quiz}
          setQuiz={setQuiz}
          completionIntent={completionIntent}
          setCompletionIntent={setCompletionIntent}
          actualMinutes={actualMinutes}
          setActualMinutes={setActualMinutes}
          note={note}
          setNote={setNote}
          scenario={scenario}
          scenarioChoice={scenarioChoice}
          setScenarioChoice={setScenarioChoice}
          loadScenario={loadScenario}
          submit={submitFeedback}
          busy={busy}
        />}
      </Drawer>
      <Drawer open={Boolean(selectedTaskId)} close={() => setSelectedTaskId(null)} title="任务契约" wide>
        {orchestration?.weeklyPackage?.tasks.find((task) => task.id === selectedTaskId) && (
          <TaskContract task={orchestration.weeklyPackage.tasks.find((task) => task.id === selectedTaskId)!} />
        )}
      </Drawer>
    </Shell>
  );
}

function IntakeView(props: {
  goal: string; setGoal: (value: string) => void;
  weeklyCapacity: LearningIntake["weeklyCapacity"]; setWeeklyCapacity: (value: LearningIntake["weeklyCapacity"]) => void;
  materials: Material[]; analyses: Record<number, MaterialAnalysisResult>; busy: string;
  updateMaterial: (index: number, field: keyof Material, value: string) => void;
  analyze: (index: number) => void; addMaterial: () => void; removeMaterial: (index: number) => void;
  submit: () => void; cancel?: () => void;
}) {
  return <section className="cl-intake">
    <div className="cl-intake-copy"><span>01 · 处境</span><h2>先形成一个可检验的学习目标假设</h2><p>告诉 Trellis 你的目标与时间，带上已收藏的课程或资讯。先判断材料与学习顺序，再安排能开始的第一步。</p><div><BookOpen size={19} /><strong>不是课程推荐墙</strong><small>课程、文章和链接只是来源；路线单位是能力和任务。</small></div></div>
    <div className="cl-intake-form">
      <label>想学的方向<textarea value={props.goal} onChange={(event) => props.setGoal(event.target.value)} placeholder="可以很模糊，例如：我想从零开始理解 AI 产品经理到底要会什么。" /></label>
      <label>每周可用时间<select value={props.weeklyCapacity} onChange={(event) => props.setWeeklyCapacity(event.target.value as LearningIntake["weeklyCapacity"])}>{capacityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="cl-material-head"><div><strong>已有来源</strong><small>没有也可以，最多 8 项</small></div><button onClick={props.addMaterial} disabled={props.materials.length >= 8}>添加来源</button></div>
      <div className="cl-material-list">{props.materials.map((material, index) => <article key={index}><div><input value={material.title} onChange={(event) => props.updateMaterial(index, "title", event.target.value)} placeholder="课程名称" /><input value={material.url} onChange={(event) => props.updateMaterial(index, "url", event.target.value)} placeholder="公开课程链接（可选）" /></div><textarea value={material.outline} onChange={(event) => props.updateMaterial(index, "outline", event.target.value)} placeholder="粘贴课程目录或摘要，陌生课程需要这些信息才能判断" /><footer><span>{props.analyses[index]?.message ?? "尚未分析"}</span><div><button onClick={() => props.analyze(index)} disabled={props.busy === `analyze-${index}`}>先判断</button>{props.materials.length > 1 && <button onClick={() => props.removeMaterial(index)} aria-label="移除课程"><X size={15} /></button>}</div></footer></article>)}</div>
      <div className="cl-form-actions">{props.cancel && <button onClick={props.cancel}>取消</button>}<button className="cl-start-button" disabled={!props.goal.trim() || props.busy === "intake"} onClick={props.submit}>生成学习路线 <ChevronRight size={17} /></button></div>
    </div>
  </section>;
}

function ProposalView({ state, curriculum, busy, revise, confirm, editInput }: { state: CourseIntelligenceState; curriculum: CurriculumRecord; busy: string; revise: (items: CurriculumConstraint[]) => void; confirm: (item: CurriculumRecord) => void; editInput: () => void }) {
  const review = routeReviewSummary(curriculum.assembly, state.graph.nodes);
  return <section className="cl-proposal">
    <div className="cl-proposal-hero"><div><span>方案版本 {curriculum.revision ?? 1}</span><h2>{review.limited ? "先核对未覆盖的目标" : "你的学习路线与第一周行动"}</h2><p>你的目标：{curriculum.intake.goal}</p></div></div>
    <section className="cl-route-coverage" aria-label="路线覆盖与下一步"><h3>{review.coverageLabel}</h3>
      <p>已安排：{review.covered.join("、") || "尚无可确认的目标覆盖"}。</p>
      {review.limited && <><p><strong>尚未安排：</strong>{review.missing.join("、") || "材料或前置仍存在缺口，详见下方取舍"}。</p><p>先做下面的内容只能完成目标的一部分；缺失目标不会因为采用路线而自动补齐。</p></>}
      <div className="cl-route-actions"><button disabled={Boolean(busy)} onClick={editInput}>补充材料或修改目标</button><a href="#route-material-decisions">调整材料取舍</a></div>
    </section>
    {review.firstAction && <section className="cl-route-coverage"><h3>确认后第一步做什么</h3><p><strong>{review.firstAction.title}</strong> · 预计{review.firstAction.minutes}分钟</p><p>{review.firstAction.location}</p><p>做到这里即可：{review.firstAction.stopCondition}</p><details><summary>为什么这样安排</summary><p>{curriculum.assembly.rationale}</p></details></section>}
    <div id="route-material-decisions" tabIndex={-1}><CurriculumDetails state={state} curriculum={curriculum} revise={revise} busy={busy} /></div>
    <footer className="cl-proposal-footer"><div><strong>{review.limited ? "采用后仍保留上述缺口" : "确认后从第一个能力任务开始"}</strong><span>这次确认同时启用路线和首周任务；后续修改另行确认。</span></div><button className="cl-start-button" onClick={() => confirm(curriculum)} disabled={Boolean(busy) || !review.firstAction}>{review.confirmLabel} <ChevronRight size={17} /></button></footer>
  </section>;
}

function CurriculumDetails({ state, curriculum, revise, busy }: { state: CourseIntelligenceState; curriculum: CurriculumRecord; revise: (items: CurriculumConstraint[]) => void; busy: string }) {
  const adopted = curriculum.assembly.decisions.filter((item) => ["anchor", "selected_units", "supplement"].includes(item.role));
  const inactive = curriculum.assembly.decisions.filter((item) => ["defer", "exclude"].includes(item.role));
  return <div className="cl-curriculum-details">
    <div className="cl-adopted-grid">{adopted.map((decision) => { const course = courseOf(state, decision.courseId); return <article key={decision.courseId}><div className="cl-course-role"><span>{roleText[decision.role]}</span><small>{decision.selectedUnitIds.length ? `${decision.selectedUnitIds.length} 个章节` : "整段采用"}</small></div><h3>{course?.title ?? decision.courseId}</h3><p>{decision.rationale}</p><div className="cl-route-actions"><button disabled={busy === "revise"} onClick={() => revise([{ type: "defer_course", courseId: decision.courseId }])}>移到后续</button><button disabled={busy === "revise"} onClick={() => revise([{ type: "exclude_course", courseId: decision.courseId }])}>暂不采用</button></div></article>; })}</div>
    <div className="cl-stage-list"><h3>学习顺序</h3>{curriculum.assembly.stages.map((stage, index) => <div key={stage.id}><i>{index + 1}</i><div><strong>{stage.title}</strong><p>{stage.objective}</p><small>到这里停止：{stage.exitCriteria.join("；")}</small></div></div>)}</div>
    {inactive.length > 0 && <details className="cl-inactive"><summary>后续与暂不采用 · {inactive.length} 门</summary>{inactive.slice(0, 8).map((decision) => <div key={decision.courseId}><span>{roleText[decision.role]}</span><strong>{courseOf(state, decision.courseId)?.title ?? decision.courseId}</strong><button disabled={busy === "revise"} onClick={() => revise([{ type: "pin_course", courseId: decision.courseId }])}>改为采用</button></div>)}{inactive.length > 8 && <p>其余 {inactive.length - 8} 门保持暂缓，不进入当前学习主线。</p>}</details>}
    {!!curriculum.assembly.sourceSelections?.length && <section className="cl-gaps"><h3>已有材料的取舍</h3>{curriculum.assembly.sourceSelections.map(item => <article key={item.fragmentId}><strong>{item.title} · {item.role === "adopted" ? "已纳入路线" : item.role === "supplement" ? "可选补充" : "暂缓"}</strong><p>{item.rationale}</p>{item.sourceQuote && <blockquote>原文依据：{item.sourceQuote}</blockquote>}{item.reviewCautions?.map(caution => <p key={caution}>待核验：{caution}</p>)}<small>分析版本 {item.analysisVersion} · 已确认片段，非事实核验</small>{item.url && <p><a href={item.url} target="_blank" rel="noreferrer">查看来源 ↗</a></p>}</article>)}</section>}
    {!!curriculum.assembly.sourceIssues?.length && <section className="cl-gaps"><h3>尚未进入路线的材料</h3>{curriculum.assembly.sourceIssues.map(item => <p key={item.sourceId}><strong>{item.title}</strong>：{item.reason} <a href="/workbench">去处理 ↗</a></p>)}</section>}
    {curriculum.assembly.unresolvedGaps.length > 0 && <details className="cl-gaps"><summary>查看材料与前置缺口的详细原因</summary>{curriculum.assembly.unresolvedGaps.map((gap) => <p key={gap}>{gap}</p>)}</details>}
  </div>;
}

function FeedbackPanel(props: {
  activityTitle: string;
  feedback: "understood" | "uncertain" | "blocked"; setFeedback: (value: "understood" | "uncertain" | "blocked") => void;
  quiz: "not_taken" | "passed" | "failed"; setQuiz: (value: "not_taken" | "passed" | "failed") => void;
  completionIntent: "auto" | "complete" | "keep_open"; setCompletionIntent: (value: "auto" | "complete" | "keep_open") => void;
  actualMinutes: number; setActualMinutes: (value: number) => void; note: string; setNote: (value: string) => void;
  scenario: PublicScenarioCheck | null; scenarioChoice: string; setScenarioChoice: (value: string) => void;
  loadScenario: () => void; submit: () => void; busy: string;
}) {
  return <div className="cl-feedback-drawer"><div className="cl-feedback-activity"><small>当前片段</small><strong>{props.activityTitle}</strong></div><fieldset><legend>现在的感觉</legend><div className="cl-segments">{[["understood", "理解了"], ["uncertain", "还不确定"], ["blocked", "卡住了"]].map(([value, label]) => <button type="button" className={props.feedback === value ? "active" : ""} key={value} onClick={() => props.setFeedback(value as typeof props.feedback)}>{label}</button>)}</div></fieldset><fieldset><legend>课程原测验（可选）</legend><div className="cl-segments">{[["not_taken", "没有做"], ["passed", "通过"], ["failed", "未通过"]].map(([value, label]) => <button type="button" className={props.quiz === value ? "active" : ""} key={value} onClick={() => props.setQuiz(value as typeof props.quiz)}>{label}</button>)}</div></fieldset>{props.scenario ? <div className="cl-scenario"><strong>{props.scenario.prompt}</strong>{props.scenario.options.map((option) => <label key={option.id}><input type="radio" name="scenario" checked={props.scenarioChoice === option.id} onChange={() => props.setScenarioChoice(option.id)} /><span>{option.text}</span></label>)}</div> : <button className="cl-quiet-button" onClick={props.loadScenario} disabled={props.busy === "scenario"}>做一道可选情景判断</button>}<label>补充一句（可选）<textarea value={props.note} onChange={(event) => props.setNote(event.target.value)} placeholder="哪里清楚、哪里卡住，或者你会如何判断。" /></label><div className="cl-feedback-meta"><label>实际用时<input type="number" min={1} max={720} value={props.actualMinutes} onChange={(event) => props.setActualMinutes(Number(event.target.value))} /><span>分钟</span></label><label>片段状态<select value={props.completionIntent} onChange={(event) => props.setCompletionIntent(event.target.value as typeof props.completionIntent)}><option value="auto">由反馈判断</option><option value="complete">确认完成</option><option value="keep_open">保留继续</option></select></label></div><div className="cl-drawer-actions"><p>提交后会先总结你获得的信号，再说明下一步变化。</p><button className="cl-start-button" onClick={props.submit} disabled={props.busy === "feedback"}>保存并查看结果 <ChevronRight size={17} /></button></div></div>;
}

function TaskContract({ task }: { task: OrchestrationTask }) {
  return <div className="cl-task-contract">
    <div className="cl-contract-lead"><span>能力任务</span><h3>{task.title}</h3><p>{task.capabilityProblem}</p></div>
    <dl>
      <div><dt>为什么现在做</dt><dd>{task.whyNow}</dd></div>
      <div><dt>学习方式</dt><dd>{task.learningMode}</dd></div>
      <div><dt>完成后应该能做什么</dt><dd>{task.expectedOutcome}</dd></div>
      <div><dt>出口检查</dt><dd>{assessmentLabel(task.assessment)}。{task.evidenceSignal}</dd></div>
      <div><dt>停止条件</dt><dd>{task.stopCondition}</dd></div>
      <div><dt>如果没有通过</dt><dd>{task.failureAction}</dd></div>
      <div><dt>在成长路径中的意义</dt><dd>{task.pathMeaning}</dd></div>
    </dl>
    <div className="cl-contract-sources"><strong>来源片段</strong>{task.sourceFragments.map((source) => <span key={`${source.title}-${source.locator}`}>{source.title} · {source.locator} · {source.precision}</span>)}</div>
  </div>;
}

function FeedbackSummary({ summary, close }: { summary: FeedbackSummaryData; close: () => void }) {
  const interpretation = summary.interpretation;
  const outcomeLabel: Record<string, string> = {
    advance: "可以继续",
    review: "建议回看",
    repair_prerequisite: "先补前置",
    reduce_scope: "缩小范围",
    replan: "需要调整路线",
  };
  return <div className="cl-feedback-summary">
    <span className="cl-summary-kicker">本次学习结果</span>
    <h3>{outcomeLabel[interpretation?.outcome ?? ""] ?? "已保存学习信号"}</h3>
    <p>{interpretation?.rationale ?? "系统已保存这次学习反馈，并会用于下一步判断。"}</p>
    <div className="cl-summary-grid"><div><small>能力证据</small><strong>{interpretation?.keepsActivityOpen ? "仍在形成" : "已留下信号"}</strong></div><div><small>下一步</small><strong>{summary.nextAction ?? "查看学习页的下一项任务"}</strong></div></div>
    {summary.materializedAdaptation?.summary && <div className="cl-summary-change"><small>系统做了什么变化</small><strong>{summary.materializedAdaptation.summary}</strong><span>{summary.materializedAdaptation.applied ? "已应用到当前学习" : "等待确认，当前路线未改变"}</span></div>}
    <button className="cl-start-button" onClick={close}>回到学习页 <ChevronRight size={17} /></button>
  </div>;
}

function LearningTaskResultView({ result, close }: { result: LearningTaskResult; close: () => void }) {
  const evidenceLabel = result.evidenceStrength === "strong" ? "较强证据" : result.evidenceStrength === "developing" ? "形成中" : "初步信号";
  return <div className="cl-feedback-summary cl-task-result">
    <span className="cl-summary-kicker">任务结果已保存</span>
    <h3>{result.capabilityTitle}</h3>
    <p>{result.submittedSignal.summary}</p>
    <div className="cl-summary-grid"><div><small>这次获得的能力信号</small><strong>{evidenceLabel}</strong></div><div><small>下一步</small><strong>{result.nextAction}</strong></div></div>
    <div className="cl-result-section"><small>你刚刚接触并练习了</small>{result.learnedConcepts.map((item) => <p key={item}><Check size={14} />{item}</p>)}</div>
    <div className="cl-result-section"><small>这次判断的依据</small>{result.evaluationBasis?.map((item) => <p key={item}><span>·</span>{item}</p>)}</div>
    <div className="cl-result-section"><small>目前还没有被证明</small>{(result.notYetProven.length ? result.notYetProven : ["一次任务结果不等于稳定掌握，后续还需要迁移到真实场景。"]).map((item) => <p key={item}><span>·</span>{item}</p>)}</div>
    <div className="cl-summary-change"><small>为什么这样安排下一步</small><strong>{result.nextActionReason}</strong>{result.adaptation && <span>{result.adaptation.applied ? "这次调整已应用到当前任务包" : "这次调整等待确认"}</span>}</div>
    <button className="cl-start-button" onClick={close}>回到学习页 <ChevronRight size={17} /></button>
  </div>;
}

function Drawer({ open, close, title, wide = false, children }: { open: boolean; close: () => void; title: string; wide?: boolean; children: React.ReactNode }) {
  const panel = useRef<HTMLElement>(null);
  const onClose = useRef(close);
  useEffect(() => { onClose.current = close; }, [close]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("button, input, textarea, select, a[href]")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose.current(); }
      if (event.key === "Tab") {
        const elements = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]') ?? [])].filter(element => element.getClientRects().length);
        const target = event.shiftKey ? elements.at(-1) : elements[0];
        if (document.activeElement === (event.shiftKey ? elements[0] : elements.at(-1))) { event.preventDefault(); target?.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [open]);
  if (!open) return null;
  return <div className="cl-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><aside ref={panel} className={`cl-drawer ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button aria-label="关闭" title="关闭" onClick={close}><X size={19} /></button></header><div className="cl-drawer-body">{children}</div></aside></div>;
}

function formatRelative(value: string | null | undefined) {
  if (!value) return "尚未开始";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 2) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} 小时前`;
  return `${Math.round(minutes / 1440)} 天前`;
}

function entryModeLabel(value: LearningOrchestrationState["situation"]["entryMode"] | undefined) {
  if (value === "zero_material") return "零材料启动";
  if (value === "source_overload") return "来源过载";
  if (value === "guided_sources") return "已有来源";
  return "待诊断";
}

function assessmentLabel(value: LearningOrchestrationState["controlCenter"]["testMachine"][number]["kind"]) {
  if (value === "diagnostic") return "起点诊断";
  if (value === "exit_ticket") return "出口检查";
  if (value === "teach_back") return "复述解释";
  if (value === "retest") return "延迟复测";
  if (value === "rubric") return "量规评审";
  return "场景判断";
}
