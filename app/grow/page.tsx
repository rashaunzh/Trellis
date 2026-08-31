"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "../_components/shell";
import {
  fetchCourseIntelligenceState,
  fetchCurrentLearning,
  type CourseIntelligenceState,
  type CurrentLearningState,
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
  const curriculum = state.curriculum;
  if (!curriculum?.assembly.targetNodeIds.includes(nodeId)) return "outside";
  const canonical = current?.knowledgeStates.find((item) => item.nodeId === nodeId);
  if (canonical?.status === "confirmed") return "validated";
  if (canonical?.status === "has_signal") return "signal";
  const related = current?.activities.filter((activity) => activity.canonicalNodeId === nodeId) ?? [];
  if (related.some((activity) => activity.status === "in_progress")) return "learning";
  return "planned";
}
export default function GrowPage() {
  const [state, setState] = useState<CourseIntelligenceState | null>(null);
  const [current, setCurrent] = useState<CurrentLearningState | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "route">("all");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([fetchCourseIntelligenceState(), fetchCurrentLearning().catch(() => null)])
      .then(([nextState, nextCurrent]) => { if (alive) { setState(nextState); setCurrent(nextCurrent); } })
      .catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "成长地图加载失败"); });
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => {
    if (!state) return { route: 0, learning: 0, signal: 0 };
    const statuses = state.graph.nodes.map((node) => nodeStatus(state, current, node.id));
    return {
      route: statuses.filter((status) => status !== "outside").length,
      learning: statuses.filter((status) => status === "learning" || status === "planned").length,
      signal: statuses.filter((status) => status === "signal" || status === "validated").length,
    };
  }, [state, current]);

  if (!state) return <Shell><div className="t2-center"><b className="t2-loading">Trellis</b><p>{error || "正在展开领域图……"}</p></div></Shell>;

  const selected = state.graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedMappings = selected && state.curriculum
    ? state.curriculum.assembly.mappings.filter((mapping) => mapping.nodeId === selected.id)
    : [];

  return (
    <Shell>
      <header className="ci-topbar grow-topbar">
        <div><p className="t2-kicker">成长 · {state.graph.version} 发布图</p><h1>{state.graph.title}</h1><p>领域结构来自多类来源；你的路线只是其中一条投影，不把不相关能力塞进当前要求。</p></div>
        <div className="grow-metrics"><span><b>{state.graph.nodes.length}</b>领域节点</span><span><b>{counts.route}</b>当前路线</span><span><b>{counts.signal}</b>已有信号</span></div>
      </header>

      {!state.curriculum && <div className="grow-empty"><h2>还没有个人路线</h2><p>先在学习页描述目标。领域图可以浏览，但不会假装知道你需要学哪些节点。</p><a href="/learn" className="t2-primary t2-link">去说明目标</a></div>}

      <div className="grow-controls">
        <div><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>完整领域</button><button className={filter === "route" ? "active" : ""} onClick={() => setFilter("route")}>当前路线</button></div>
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
        <div className="grow-node-panel" role="dialog" aria-modal="true" aria-label={selected.title}>
          <button className="grow-close" aria-label="关闭" onClick={() => setSelectedNodeId(null)}>×</button>
          <p className="t2-kicker">{state.graph.categories.find((category) => category.id === selected.categoryId)?.title}</p>
          <h2>{selected.title}</h2>
          <p>{selected.description}</p>
          <dl><div><dt>当前状态</dt><dd>{statusText[nodeStatus(state, current, selected.id)]}</dd></div><div><dt>目标深度</dt><dd>{selected.targetDepth}/3</dd></div></dl>
          <h3>学完应该能做什么</h3>
          <ul>{selected.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul>
          <h3>真实前置</h3>
          <p>{selected.prerequisiteNodeIds.length ? selected.prerequisiteNodeIds.map((id) => state.graph.nodes.find((node) => node.id === id)?.title ?? id).join(" → ") : "无"}</p>
          <h3>当前课程覆盖</h3>
          {selectedMappings.length ? selectedMappings.map((mapping) => {
            const course = state.catalog.find((item) => item.id === mapping.courseId);
            const unit = course?.units.find((item) => item.id === mapping.unitId);
            return <a key={`${mapping.courseId}:${mapping.unitId}`} href={course?.url} target="_blank" rel="noreferrer"><b>{course?.title}</b><span>{unit?.title} · 映射置信度 {Math.round(mapping.confidence * 100)}%</span></a>;
          }) : <p>当前路线尚未采用覆盖这一节点的课程章节。</p>}
          <h3>结构依据</h3>
          {selected.sourceCitations.map((citation) => <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer">{citation.title} ↗</a>)}
        </div>
      )}
    </Shell>
  );
}
