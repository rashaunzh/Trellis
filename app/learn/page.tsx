"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "../_components/shell";
import {
  analyzeCourseMaterial,
  confirmCurriculum,
  createCurriculum,
  fetchCourseIntelligenceState,
  fetchWorkspace,
  recordLearningSignal,
  type CourseIntelligenceState,
  type CurriculumRecord,
  type MaterialAnalysisResult,
  type Workspace,
} from "../../lib/learning/frontend";

const capacityOptions = [
  ["light", "每周约 2 小时"],
  ["steady", "每周约 3-4 小时"],
  ["focused", "每周约 5-6 小时"],
  ["intensive", "每周 7 小时以上"],
] as const;

const decisionLabels = {
  anchor: "当前主线",
  selected_units: "只学选定章节",
  supplement: "补充参考",
  defer: "后续再学",
  exclude: "当前跳过",
} as const;

function courseOf(state: CourseIntelligenceState, courseId: string) {
  return state.catalog.find((course) => course.id === courseId);
}
function unitOf(state: CourseIntelligenceState, courseId: string, unitId: string) {
  return courseOf(state, courseId)?.units.find((unit) => unit.id === unitId);
}

export default function LearnPage() {
  const [state, setState] = useState<CourseIntelligenceState | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [goal, setGoal] = useState("");
  const [weeklyCapacity, setWeeklyCapacity] = useState<(typeof capacityOptions)[number][0]>("steady");
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");
  const [materialOutline, setMaterialOutline] = useState("");
  const [materialAnalysis, setMaterialAnalysis] = useState<MaterialAnalysisResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedbackState, setFeedbackState] = useState("understood");
  const [quizState, setQuizState] = useState("not_taken");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  async function refresh() {
    const [nextState, nextWorkspace] = await Promise.all([
      fetchCourseIntelligenceState(),
      fetchWorkspace().catch(() => null),
    ]);
    setState(nextState);
    setWorkspace(nextWorkspace);
  }

  useEffect(() => {
    let alive = true;
    Promise.all([fetchCourseIntelligenceState(), fetchWorkspace().catch(() => null)])
      .then(([nextState, nextWorkspace]) => {
        if (!alive) return;
        setState(nextState);
        setWorkspace(nextWorkspace);
      })
      .catch((cause) => {
        if (alive) setError(cause instanceof Error ? cause.message : "课程智能加载失败");
      });
    return () => { alive = false; };
  }, []);

  const curriculum = state?.curriculum ?? null;
  const activeDecisions = curriculum?.assembly.decisions.filter((decision) =>
    decision.role === "anchor" || decision.role === "selected_units" || decision.role === "supplement",
  ) ?? [];
  const deferredDecisions = curriculum?.assembly.decisions.filter((decision) =>
    decision.role === "defer" || decision.role === "exclude",
  ) ?? [];
  const currentActivity = workspace?.activities.find((activity) => activity.status !== "completed") ?? workspace?.activities[0] ?? null;
  const currentRef = currentActivity?.courseId && currentActivity.unitId
    ? { courseId: currentActivity.courseId, unitId: currentActivity.unitId }
    : curriculum?.assembly.stages[0]?.unitRefs[0];
  const currentCourse = state && currentRef ? courseOf(state, currentRef.courseId) : null;
  const currentUnit = state && currentRef ? unitOf(state, currentRef.courseId, currentRef.unitId) : null;
  const progressCount = useMemo(() => workspace?.activities.filter((activity) => activity.status === "completed").length ?? 0, [workspace]);

  if (!state) {
    return (
      <Shell>
        <div className="t2-center">
          <b className="t2-loading">Trellis</b>
          <p>{error || "正在读取已发布课程目录与学习状态……"}</p>
          {error.includes("learning_ci_") && <small>本地数据库尚未应用 `0013_course_intelligence.sql`。</small>}
        </div>
      </Shell>
    );
  }

  const showIntake = editing || !curriculum;

  async function submitIntake() {
    if (!goal.trim()) return;
    setBusy(true);
    setError("");
    try {
      const materials = materialTitle.trim() || materialUrl.trim() || materialOutline.trim()
        ? [{ title: materialTitle.trim(), url: materialUrl.trim(), outline: materialOutline.trim() }]
        : [];
      await createCurriculum({ goal: goal.trim(), weeklyCapacity, materials });
      setEditing(false);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "生成课程方案失败");
    } finally {
      setBusy(false);
    }
  }

  async function analyzeMaterial() {
    if (!materialUrl.trim() && !materialOutline.trim()) return;
    setBusy(true);
    setError("");
    try {
      setMaterialAnalysis(await analyzeCourseMaterial({ title: materialTitle, url: materialUrl, outline: materialOutline }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "材料分析失败");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(record: CurriculumRecord) {
    setBusy(true);
    setError("");
    try {
      await confirmCurriculum(record.id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "确认课程方案失败");
    } finally {
      setBusy(false);
    }
  }

  async function sendFeedback() {
    if (!currentActivity) return;
    setBusy(true);
    setError("");
    try {
      const input = quizState !== "not_taken"
        ? { type: "quiz_result" as const, value: quizState === "passed" ? 100 : 50, note: feedbackNote.trim() }
        : feedbackState === "blocked"
          ? { type: "stuck" as const, value: feedbackNote.trim() || "当前卡住，但暂未描述具体原因", note: feedbackNote.trim() }
          : { type: "understanding" as const, value: feedbackState === "understood", note: feedbackNote.trim() };
      await recordLearningSignal(currentActivity.id, input);
      setFeedbackMessage(input.type === "stuck" || input.value === false
        ? "反馈已记录。Trellis 会保留卡点，不把“看完”冒充掌握。"
        : "反馈已记录，这一节可以继续推进。");
      await refresh();
      setFeedbackNote("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "记录学习反馈失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <header className="ci-topbar">
        <div>
          <p className="t2-kicker">课程智能 · {state.catalogCount} 个代表课程 · {state.sourceCount} 类来源</p>
          <h1>{showIntake ? "先说清楚你想获得什么能力" : curriculum.status === "draft" ? "检查 Trellis 的课程取舍" : "继续当前最值得推进的一节"}</h1>
        </div>
        <span className={`ci-model ${state.model.available ? "online" : "baseline"}`}>
          {state.model.available ? "内置 AI 已启用" : "已发布基线可用"}
        </span>
      </header>

      {error && <p className="t2-error">{error}</p>}

      {showIntake && (
        <section className="ci-intake">
          <div className="ci-intake-copy">
            <p className="t2-kicker">只需要三个输入</p>
            <h2>不用先判断自己属于哪种“入门”</h2>
            <p>Trellis 会先解释目标涉及哪些共同基础和专业分支，再从课程目录中做取舍。你可以带着现有课程来，也可以从已发布课程库开始。</p>
            <dl>
              <div><dt>不会做</dt><dd>把所有知名课程排成收藏清单</dd></div>
              <div><dt>会做</dt><dd>选主线、指定章节、说明跳过理由和退出位置</dd></div>
            </dl>
          </div>
          <div className="ci-intake-form">
            <label>
              你最终希望能判断或完成什么？
              <textarea value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="例如：我想能独立判断一个 Agent 产品场景，设计能力边界、人工兜底和最小评测方案。" />
            </label>
            <label>
              每周大约可投入
              <select value={weeklyCapacity} onChange={(event) => setWeeklyCapacity(event.target.value as typeof weeklyCapacity)}>
                {capacityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <details className="ci-material-input" open={Boolean(materialTitle || materialUrl || materialOutline)}>
              <summary>我已经有一门课程或课程目录</summary>
              <label>课程名称（可选）<input value={materialTitle} onChange={(event) => setMaterialTitle(event.target.value)} placeholder="课程名称" /></label>
              <label>公开链接（可选）<input value={materialUrl} onChange={(event) => setMaterialUrl(event.target.value)} placeholder="https://..." /></label>
              <label>目录或摘要（抓不到网页时粘贴）<textarea value={materialOutline} onChange={(event) => setMaterialOutline(event.target.value)} placeholder="每行一个章节，或粘贴公开课程摘要。" /></label>
              <button className="t2-secondary" disabled={busy || (!materialUrl.trim() && !materialOutline.trim())} onClick={() => void analyzeMaterial()}>先判断这份材料</button>
              {materialAnalysis && (
                <div className={`ci-analysis-result ${materialAnalysis.status}`}>
                  <b>{materialAnalysis.message}</b>
                  {materialAnalysis.extractedUnits.length > 0 && <p>识别到：{materialAnalysis.extractedUnits.slice(0, 8).join("、")}</p>}
                </div>
              )}
            </details>
            <div className="ci-form-actions">
              {curriculum && <button className="t2-secondary" onClick={() => setEditing(false)}>取消</button>}
              <button className="t2-primary" disabled={busy || !goal.trim()} onClick={() => void submitIntake()}>{busy ? "正在做课程取舍……" : "生成课程方案"}</button>
            </div>
          </div>
        </section>
      )}

      {!showIntake && curriculum.status === "draft" && (
        <CurriculumProposal state={state} curriculum={curriculum} activeDecisions={activeDecisions} deferredDecisions={deferredDecisions} busy={busy} onEdit={() => {
          setGoal(curriculum.intake.goal);
          setWeeklyCapacity(curriculum.intake.weeklyCapacity);
          const material = curriculum.intake.materials[0];
          setMaterialTitle(material?.title ?? ""); setMaterialUrl(material?.url ?? ""); setMaterialOutline(material?.outline ?? "");
          setEditing(true);
        }} onConfirm={() => void confirm(curriculum)} />
      )}

      {!showIntake && curriculum.status === "confirmed" && (
        <div className="ci-learning">
          <section className="ci-current-action">
            <div className="ci-action-main">
              <p className="t2-kicker">本次学习 · {currentActivity?.estimatedMinutes ?? currentUnit?.estimatedMinutes ?? 45} 分钟</p>
              <span>{currentCourse?.provider}</span>
              <h2>{currentUnit?.title ?? currentActivity?.title ?? "本周课程单元"}</h2>
              <p>{curriculum.assembly.stages[0]?.objective}</p>
              <div className="ci-stop-condition">
                <b>学到这里就可以停</b>
                <p>{curriculum.assembly.stages[0]?.exitCriteria.join("；")}</p>
              </div>
              <div className="ci-action-buttons">
                {currentCourse?.url && <a className="t2-primary t2-link" href={currentCourse.url} target="_blank" rel="noreferrer">打开这一节 ↗</a>}
                <button className="t2-secondary" onClick={() => setEditing(true)}>重新梳理目标</button>
              </div>
            </div>
            <aside>
              <span>本周路线</span>
              <strong>{progressCount}/{workspace?.activities.length ?? 0}</strong>
              <p>只计算当前采用章节，不要求通关整个平台目录。</p>
            </aside>
          </section>

          <section className="ci-week-strip">
            <header><div><p className="t2-kicker">接下来</p><h2>本周采用的准确章节</h2></div><span>{activeDecisions.length} 个来源</span></header>
            <div>
              {curriculum.assembly.stages.flatMap((stage) => stage.unitRefs).slice(0, 5).map((ref, index) => {
                const course = courseOf(state, ref.courseId);
                const unit = unitOf(state, ref.courseId, ref.unitId);
                return <article key={`${ref.courseId}:${ref.unitId}`} className={index === 0 ? "current" : ""}><b>{String(index + 1).padStart(2, "0")}</b><div><span>{course?.title}</span><strong>{unit?.title}</strong></div><small>{unit?.estimatedMinutes ?? 45} 分钟</small></article>;
              })}
            </div>
          </section>

          <section className="ci-feedback">
            <div><p className="t2-kicker">学习反馈</p><h2>不写作业，也要让后续编排知道发生了什么</h2><p>课程自己的测试结果可以直接成为学习信号。Trellis 不把“看完”自动判成掌握。</p></div>
            <div className="ci-feedback-form">
              <label>现在的状态<select value={feedbackState} onChange={(event) => setFeedbackState(event.target.value)}><option value="understood">能说明关键判断</option><option value="uncertain">部分理解，仍不确定</option><option value="blocked">卡住了</option></select></label>
              <label>课程测试<select value={quizState} onChange={(event) => setQuizState(event.target.value)}><option value="not_taken">没有测试 / 还没做</option><option value="passed">已通过</option><option value="failed">未通过</option></select></label>
              <label className="wide">一句判断或卡点（可选）<textarea value={feedbackNote} onChange={(event) => setFeedbackNote(event.target.value)} placeholder="例如：Agent 不等于完全自治，关键是工具边界和人工确认点。" /></label>
              <button className="t2-primary" disabled={busy || !currentActivity} onClick={() => void sendFeedback()}>记录并继续</button>
              {feedbackMessage && <p className="ci-feedback-message">{feedbackMessage}</p>}
            </div>
          </section>

          <details className="ci-route-details">
            <summary>查看完整课程取舍与路线缺口</summary>
            <CurriculumDetails state={state} curriculum={curriculum} activeDecisions={activeDecisions} deferredDecisions={deferredDecisions} />
          </details>
        </div>
      )}
    </Shell>
  );
}

function CurriculumProposal({ state, curriculum, activeDecisions, deferredDecisions, busy, onEdit, onConfirm }: {
  state: CourseIntelligenceState;
  curriculum: CurriculumRecord;
  activeDecisions: CurriculumRecord["assembly"]["decisions"];
  deferredDecisions: CurriculumRecord["assembly"]["decisions"];
  busy: boolean;
  onEdit: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="ci-proposal">
      <section className="ci-goal-brief">
        <div><p className="t2-kicker">Trellis 对目标的理解</p><h2>{curriculum.assembly.learnerIntent}</h2><p>{curriculum.assembly.rationale}</p></div>
        <button className="t2-secondary" onClick={onEdit}>修改目标或材料</button>
      </section>
      <CurriculumDetails state={state} curriculum={curriculum} activeDecisions={activeDecisions} deferredDecisions={deferredDecisions} />
      <footer className="ci-proposal-actions">
        <p>确认后只生成当前周可执行章节。历史路线和学习记录不会被清空。</p>
        <button className="t2-primary" disabled={busy} onClick={onConfirm}>{busy ? "正在建立本周路线……" : "确认并开始第一节"}</button>
      </footer>
    </div>
  );
}

function CurriculumDetails({ state, curriculum, activeDecisions, deferredDecisions }: {
  state: CourseIntelligenceState;
  curriculum: CurriculumRecord;
  activeDecisions: CurriculumRecord["assembly"]["decisions"];
  deferredDecisions: CurriculumRecord["assembly"]["decisions"];
}) {
  return (
    <div className="ci-curriculum-details">
      <section className="ci-adopted">
        <header><div><p className="t2-kicker">当前采用</p><h2>少量课程，精确到章节</h2></div><span>{activeDecisions.length} / {state.catalogCount} 个来源进入当前路线</span></header>
        <div>
          {activeDecisions.map((decision) => {
            const course = courseOf(state, decision.courseId);
            return <article key={decision.courseId}><div className="ci-course-head"><span>{decisionLabels[decision.role]}</span><small>置信度 {Math.round(decision.confidence * 100)}%</small></div><h3>{course?.title ?? decision.courseId}</h3><p>{decision.rationale}</p><ul>{decision.selectedUnitIds.map((unitId) => <li key={unitId}>{unitOf(state, decision.courseId, unitId)?.title ?? unitId}</li>)}</ul><b>退出：{decision.exitCriteria.join("；")}</b></article>;
          })}
        </div>
      </section>
      <section className="ci-stages">
        <header><p className="t2-kicker">学习顺序</p><h2>先建立共同判断，再进入目标分支</h2></header>
        {curriculum.assembly.stages.map((stage, index) => <article key={stage.id}><b>{String(index + 1).padStart(2, "0")}</b><div><h3>{stage.title}</h3><p>{stage.objective}</p><span>{stage.unitRefs.map((ref) => unitOf(state, ref.courseId, ref.unitId)?.title).filter(Boolean).join(" → ")}</span><small>通过标准：{stage.exitCriteria.join("；")}</small></div></article>)}
      </section>
      <div className="ci-decisions-bottom">
        <details><summary>{deferredDecisions.length} 门课程为什么没有进入当前路线</summary>{deferredDecisions.map((decision) => <p key={decision.courseId}><b>{decisionLabels[decision.role]} · {courseOf(state, decision.courseId)?.title ?? decision.courseId}</b><span>{decision.rationale}</span></p>)}</details>
        <article><p className="t2-kicker">路线缺口</p>{curriculum.assembly.unresolvedGaps.map((gap) => <p key={gap}>{gap}</p>)}</article>
      </div>
    </div>
  );
}
