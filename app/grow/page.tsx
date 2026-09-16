"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, CircleDot, Milestone } from "lucide-react";
import Shell from "../_components/shell";
import {
  fetchCourseIntelligenceState,
  fetchCurrentLearning,
  fetchLearningOrchestration,
  type CourseIntelligenceState,
  type CurrentLearningState,
  type LearningOrchestrationState,
} from "../../lib/learning/frontend";

type MapStatus = "outside" | "planned" | "learning" | "signal" | "validated";

const statusText: Record<MapStatus, string> = {
  outside: "未涉及",
  planned: "计划中",
  learning: "学习中",
  signal: "已有信号",
  validated: "已确认",
};

function nodeStatus(state: CourseIntelligenceState, current: CurrentLearningState | null, nodeId: string): MapStatus {
  const curriculum = current?.curriculum?.status === "confirmed" ? current.curriculum : null;
  if (!curriculum?.assembly.targetNodeIds.includes(nodeId)) return "outside";
  const canonical = current?.knowledgeStates.find((item) => item.nodeId === nodeId);
  if (canonical?.status === "confirmed") return "validated";
  if (canonical?.status === "has_signal") return "signal";
  const related = current?.activities.filter((activity) => activity.canonicalNodeId === nodeId || activity.scope?.nodeIds.includes(nodeId)) ?? [];
  if (related.some((activity) => activity.status === "in_progress")) return "learning";
  return "planned";
}

function capabilityStateLabel(state: LearningOrchestrationState["capabilityModel"]["dimensions"][number]["state"]) {
  if (state === "validated") return "已验证";
  if (state === "review_due") return "需复测";
  if (state === "growing") return "成长中";
  if (state === "touched") return "已接触";
  return "未接触";
}

export default function GrowPage() {
  const [state, setState] = useState<CourseIntelligenceState | null>(null);
  const [current, setCurrent] = useState<CurrentLearningState | null>(null);
  const [orchestration, setOrchestration] = useState<LearningOrchestrationState | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "route">("route");
  const [error, setError] = useState("");
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedNodeId || !panel.current) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = panel.current;
    element.querySelector<HTMLElement>("button")?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setSelectedNodeId(null); }
      if (event.key !== "Tab") return;
      const items = [...element.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    element.addEventListener("keydown", handleKey);
    return () => { element.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [selectedNodeId]);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchCourseIntelligenceState(), fetchCurrentLearning().catch(() => null), fetchLearningOrchestration().catch(() => null)])
      .then(([nextState, nextCurrent, nextOrchestration]) => { if (alive) { setState(nextState); setCurrent(nextCurrent); setOrchestration(nextOrchestration); } })
      .catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "成长地图加载失败"); });
    return () => { alive = false; };
  }, []);

  const curriculum = current?.curriculum?.status === "confirmed" ? current.curriculum : null;

  const counts = useMemo(() => {
    if (!state) return { route: 0, learning: 0, signal: 0 };
    const statuses = state.graph.nodes.map((node) => nodeStatus(state, current, node.id));
    return {
      route: statuses.filter((status) => status !== "outside").length,
      learning: statuses.filter((status) => status === "learning").length,
      signal: statuses.filter((status) => status === "signal" || status === "validated").length,
    };
  }, [state, current]);

  if (!state) return <Shell><div className="t2-center"><b className="t2-loading">Trellis</b><p>{error || "正在展开领域图……"}</p></div></Shell>;

  const selected = state.graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedKnowledge = selected
    ? current?.knowledgeStates.find((item) => item.nodeId === selected.id) ?? null
    : null;
  const selectedMappings = selected && curriculum
    ? curriculum.assembly.mappings.filter((mapping) => mapping.nodeId === selected.id)
    : [];
  const currentActivity = current?.activities.find((activity) => activity.id === current.resumeState.activityId)
    ?? current?.activities.find((activity) => activity.status !== "completed")
    ?? null;
  const currentNodeIds = currentActivity?.scope?.nodeIds ?? (currentActivity?.canonicalNodeId ? [currentActivity.canonicalNodeId] : []);
  const currentNodes = state.graph.nodes.filter((node) => currentNodeIds.includes(node.id));
  const signaledNodes = state.graph.nodes.filter((node) => ["signal", "validated"].includes(nodeStatus(state, current, node.id)));
  const nextStage = curriculum?.assembly.stages.find((stage) =>
    stage.unitRefs.some((ref) => currentActivity?.unitId === ref.unitId))
    ?? curriculum?.assembly.stages[0];

  return (
    <Shell>
      <header className="ci-topbar grow-topbar">
        <div><p className="t2-kicker">成长 · 能力模型</p><h1>{state.graph.title}</h1><p>这里分开看两件事：路径走到哪里，以及能力是否真的被证据支持。</p></div>
        <div className="grow-metrics"><span><b>{state.graph.nodes.length}</b>领域节点</span><span><b>{counts.route}</b>当前路线</span><span><b>{counts.signal}</b>已有信号</span></div>
      </header>

      {curriculum && (
        <section className="grow-route-focus">
          <div className="grow-route-summary">
            <span><CircleDot size={15} /> 当前路线</span>
            <h2>{current?.routeSummary?.currentStageTitle ?? curriculum.assembly.learnerIntent}</h2>
            <p>{currentActivity ? `正在推进：${currentActivity.title}` : "本周片段已完成，等待下一周方案。"}</p>
            <div><strong>{counts.signal}</strong><small>有真实学习信号的节点</small><strong>{counts.learning}</strong><small>正在学习的节点</small></div>
          </div>
          <div className="grow-route-context">
            <article><Milestone size={17} /><div><small>下一里程碑</small><strong>{nextStage?.title ?? "等待下一阶段"}</strong><p>{nextStage?.exitCriteria.join("；") ?? "完成当前路线后再决定。"}</p></div></article>
            <article><CheckCircle2 size={17} /><div><small>最近获得的能力信号</small><strong>{signaledNodes.slice(-2).map((node) => node.title).join("、") || "还没有，完成一次学习反馈后出现"}</strong></div></article>
            <article><ArrowRight size={17} /><div><small>当前片段覆盖</small><strong>{currentNodes.map((node) => node.title).join("、") || "尚未进入片段"}</strong></div></article>
          </div>
        </section>
      )}

      {curriculum && orchestration && (
        <section className="grow-vein-map" aria-label="能力路径分叉">
          <div className="grow-vein-trunk">
            <small>当前主干</small>
            <strong>{orchestration.weeklyPackage?.mission ?? orchestration.situation.goalHypothesis}</strong>
            <p>{orchestration.situation.nextBestMove}</p>
          </div>
          <div className="grow-vein-branches">
            {orchestration.capabilityModel.pathBranches.slice(0, 7).map((branch, index) => (
              <button key={branch.id} className={branch.status} style={{ "--branch-index": index } as React.CSSProperties} onClick={() => setFilter("all")}>
                <span>{branch.status === "selected" ? "当前路线" : "相邻分支"}</span>
                <strong>{branch.title}</strong>
                <small>{branch.nodeIds.length} 个能力节点</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {curriculum && orchestration && (
        <section className="grow-capability-model">
          <header><div><p className="t2-kicker">能力画像</p><h2>路径深度不等于能力等级</h2></div><span>{orchestration.capabilityModel.dimensions.length} 个当前相关能力</span></header>
          <div>
            {orchestration.capabilityModel.dimensions.slice(0, 8).map((dimension) => (
              <article key={dimension.id} className={dimension.state}>
                <small>{dimension.branch}</small>
                <strong>{dimension.title}</strong>
                <p>{capabilityStateLabel(dimension.state)} · 学习记录 {dimension.evidenceCount}</p>
                <span>{dimension.nextMilestone}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      {!curriculum && <div className="grow-empty"><h2>还没有个人路线</h2><p>先在学习页描述目标。领域图可以浏览，但不会假装知道你需要学哪些节点。</p><a href="/learn" className="t2-primary t2-link">去说明目标</a></div>}

      <div className="grow-controls">
        <div><button className={filter === "route" ? "active" : ""} onClick={() => setFilter("route")}>当前路线</button><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>完整领域</button></div>
        <p><i className="planned" />计划中 <i className="learning" />学习中 <i className="signal" />已有信号 <i className="validated" />已确认</p>
      </div>

      <div className="grow-domain-map">
        {state.graph.categories.map((category, categoryIndex) => {
          const nodes = state.graph.nodes.filter((node) => node.categoryId === category.id && (filter === "all" || nodeStatus(state, current, node.id) !== "outside"));
          if (nodes.length === 0) return null;
          return (
            <section key={category.id} className="grow-domain-group">
              <header><b>{String(categoryIndex + 1).padStart(2, "0")}</b><div><h2>{category.title}</h2><p>{category.description}</p></div><span>{nodes.length} 个节点</span></header>
              <div className="grow-node-grid">
                {nodes.map((node) => {
                  const status = nodeStatus(state, current, node.id);
                  return (
                    <button key={node.id} className={`grow-node ${status} ${selectedNodeId === node.id ? "selected" : ""}`} onClick={() => setSelectedNodeId(node.id)}>
                      <span>{statusText[status]}</span>
                      <strong>{node.title}</strong>
                      <small>{node.prerequisiteNodeIds.length > 0 ? `前置 ${node.prerequisiteNodeIds.length}` : "共同起点"} · 深度 {node.targetDepth}</small>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {selected && (
        <div ref={panel} className="grow-node-panel" role="dialog" aria-modal="true" aria-label={selected.title}>
          <button className="grow-close" aria-label="关闭" onClick={() => setSelectedNodeId(null)}>×</button>
          <p className="t2-kicker">{state.graph.categories.find((category) => category.id === selected.categoryId)?.title}</p>
          <h2>{selected.title}</h2>
          <p>{selected.description}</p>
          <dl><div><dt>当前状态</dt><dd>{statusText[nodeStatus(state, current, selected.id)]}</dd></div><div><dt>目标深度</dt><dd>{selected.targetDepth}/3</dd></div></dl>
          <h3>学完应该能做什么</h3>
          <ul>{selected.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul>
          <h3>为什么在当前阶段</h3>
          <p>{selectedMappings.length
            ? "当前路线采用的课程片段覆盖这一能力节点，因此它会影响接下来的学习顺序和反馈判断。"
            : "它属于发布领域图中的相邻能力；未进入当前路线前，不会要求你投入学习。"}
          </p>
          <h3>最近能力信号</h3>
          <p>{selectedKnowledge?.latestSignalId
            ? `${statusText[nodeStatus(state, current, selected.id)]}；有已保存的反馈，不代表已验证掌握。`
            : "还没有真实学习信号。计划中不算成长，完成一次反馈后才会更新。"}
          </p>
          <h3>下一次验证方式</h3>
          <p>{selectedKnowledge?.status === "confirmed"
            ? "后续通过延迟复测或真实任务表现保持确认。"
            : "下一次学习后，用课程测验、情景判断或一句具体判断留下信号。"}
          </p>
          <h3>真实前置</h3>
          <p>{selected.prerequisiteNodeIds.length ? selected.prerequisiteNodeIds.map((id) => state.graph.nodes.find((node) => node.id === id)?.title ?? id).join(" → ") : "无"}</p>
          <h3>当前课程覆盖</h3>
          {selectedMappings.length ? selectedMappings.map((mapping) => {
            const course = state.catalog.find((item) => item.id === mapping.courseId);
            const unit = course?.units.find((item) => item.id === mapping.unitId);
            return <a key={`${mapping.courseId}:${mapping.unitId}`} href={course?.url} target="_blank" rel="noreferrer"><b>{course?.title}</b><span>{unit?.title} · 依据课程目录关联</span></a>;
          }) : <p>当前路线尚未采用覆盖这一节点的课程章节。</p>}
          <h3>结构依据</h3>
          {selected.sourceCitations.map((citation) => <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer">{citation.title} ↗</a>)}
        </div>
      )}
    </Shell>
  );
}
