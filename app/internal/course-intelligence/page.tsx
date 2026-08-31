"use client";

import { useCallback, useEffect, useState } from "react";

import "./review.css";

type Candidate = {
  id: string;
  title: string;
  sourceUrl: string;
  outline: string[];
  analysisJson: string;
  candidateJson?: string;
  evalJson?: string;
  status: "candidate" | "validated" | "rejected" | "published";
  updatedAt: string;
};

type CandidateDraft = {
  genome: {
    id: string; title: string; provider: string; url: string; version: string;
    level: "introductory" | "beginner" | "intermediate" | "advanced";
    units: Array<{ id: string; title: string; order: number; prerequisites: string[]; learningOutcomes: string[]; formats: string[] }>;
    audiences: string[]; prerequisites: string[]; learningOutcomes: string[]; sourceCitations: unknown[];
  };
  tags: string[];
  mappings: Array<{ courseId: string; unitId: string; nodeId: string; depth: 1 | 2 | 3; relation: "core" | "supporting" | "context"; confidence: number; sourceCitations: unknown[] }>;
};

type GraphNode = { id: string; title: string };

function adminHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers["content-type"] = "application/json";
  if (typeof location !== "undefined" && ["localhost", "127.0.0.1"].includes(location.hostname)) {
    headers["x-trellis-admin"] = "true";
  }
  return headers;
}

export default function CourseIntelligenceReviewPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<CandidateDraft | null>(null);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [message, setMessage] = useState("正在读取候选内容...");

  const load = useCallback(async () => {
    const response = await fetch("/api/internal/course-intelligence/candidates", {
      headers: adminHeaders(),
      cache: "no-store",
    });
    const body = await response.json() as { candidates?: Candidate[]; graph?: { nodes: GraphNode[] }; error?: string };
    if (!response.ok) {
      setMessage(body.error ?? "无法读取候选内容");
      return;
    }
    setCandidates(body.candidates ?? []);
    setGraphNodes(body.graph?.nodes ?? []);
    setSelected((current) => {
      const next = current
        ? body.candidates?.find((item) => item.id === current.id) ?? null
        : body.candidates?.[0] ?? null;
      setDraft(parseDraft(next?.candidateJson));
      return next;
    });
    setMessage((body.candidates?.length ?? 0) > 0 ? "" : "目前没有待评审课程。");
  }, []);

  useEffect(() => {
    // Initial network synchronization; state updates occur after fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function review(decision: "validated" | "rejected") {
    if (!selected || reason.trim().length < 3) {
      setMessage("请先填写至少 3 个字的评审理由。");
      return;
    }
    const response = await fetch(
      `/api/internal/course-intelligence/candidates/${encodeURIComponent(selected.id)}/review`,
      {
        method: "POST",
        headers: adminHeaders(true),
        body: JSON.stringify({ decision, reason }),
      },
    );
    const body = await response.json() as { error?: string };
    setMessage(response.ok ? "评审结果已保存。" : body.error ?? "保存失败");
    if (response.ok) {
      setReason("");
      await load();
    }
  }

  return (
    <main className="review-page">
      <header className="review-header">
        <div>
          <p>内部内容治理</p>
          <h1>课程候选评审</h1>
        </div>
        <span>{candidates.length} 个候选</span>
      </header>
      {message ? <p className="review-message" role="status">{message}</p> : null}
      <div className="review-layout">
        <nav className="candidate-list" aria-label="课程候选">
          {candidates.map((candidate) => (
            <button
              className={selected?.id === candidate.id ? "is-selected" : ""}
              key={candidate.id}
              onClick={() => {
                setSelected(candidate);
                setDraft(parseDraft(candidate.candidateJson));
              }}
              type="button"
            >
              <strong>{candidate.title}</strong>
              <span>{candidate.status} · {candidate.outline.length} 节</span>
            </button>
          ))}
        </nav>
        {selected ? (
          <section className="candidate-detail">
            <div className="candidate-title">
              <div>
                <span>{selected.status}</span>
                <h2>{selected.title}</h2>
              </div>
              {selected.sourceUrl ? <a href={selected.sourceUrl} rel="noreferrer" target="_blank">查看来源</a> : null}
            </div>
            <h3>解析目录</h3>
            <ol>{selected.outline.map((item) => <li key={item}>{item}</li>)}</ol>
            <details>
              <summary>查看模型分析原文</summary>
              <pre>{formatAnalysis(selected.analysisJson)}</pre>
            </details>
            {draft ? (
              <div className="candidate-editor">
                <h3>结构化课程草稿</h3>
                <div className="editor-grid">
                  <label>课程名<input value={draft.genome.title} onChange={(event) => updateGenome("title", event.target.value)} /></label>
                  <label>提供方<input value={draft.genome.provider} onChange={(event) => updateGenome("provider", event.target.value)} /></label>
                  <label>版本<input value={draft.genome.version} onChange={(event) => updateGenome("version", event.target.value)} /></label>
                  <label>难度<select value={draft.genome.level} onChange={(event) => updateGenome("level", event.target.value as CandidateDraft["genome"]["level"])}>
                    <option value="introductory">导论</option><option value="beginner">初级</option>
                    <option value="intermediate">中级</option><option value="advanced">高级</option>
                  </select></label>
                </div>
                <div className="mapping-list">
                  {draft.genome.units.map((unit, index) => {
                    const mapping = draft.mappings.find((item) => item.unitId === unit.id);
                    return (
                      <div className="mapping-row" key={unit.id}>
                        <label>章节 {index + 1}<input value={unit.title} onChange={(event) => updateUnit(index, event.target.value)} /></label>
                        <label>知识节点<select value={mapping?.nodeId ?? ""} onChange={(event) => updateMapping(unit.id, { nodeId: event.target.value })}>
                          {graphNodes.map((node) => <option key={node.id} value={node.id}>{node.title} · {node.id}</option>)}
                        </select></label>
                        <label>置信度<input max="1" min="0" step="0.05" type="number" value={mapping?.confidence ?? 0} onChange={(event) => updateMapping(unit.id, { confidence: Number(event.target.value) })} /></label>
                      </div>
                    );
                  })}
                </div>
                <div className="eval-report"><strong>发布检查</strong><pre>{formatAnalysis(selected.evalJson ?? "{}")}</pre></div>
                <button className="secondary" onClick={() => void saveDraft()} type="button">保存并重新检查</button>
              </div>
            ) : <p>该历史候选没有结构化草稿，请重新分析材料。</p>}
            <label htmlFor="review-reason">评审理由</label>
            <textarea
              id="review-reason"
              onChange={(event) => setReason(event.target.value)}
              placeholder="说明来源、章节映射或质量判断依据"
              value={reason}
            />
            <div className="review-actions">
              <button className="secondary" onClick={() => void review("rejected")} type="button">退回</button>
              <button onClick={() => void review("validated")} type="button">验证候选</button>
            </div>
            {selected.status === "validated" ? (
              <details className="publish-panel">
                <summary>发布已验证课程</summary>
                <p>将当前已验证草稿发布到共享课程目录。发布后既有路线仍引用原版本。</p>
                <button onClick={() => void publishCandidate()} type="button">执行发布检查</button>
              </details>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );

  async function publishCandidate() {
    if (!selected || !draft) return;
    const response = await fetch(
      `/api/internal/course-intelligence/candidates/${encodeURIComponent(selected.id)}/publish`,
      {
        method: "POST",
        headers: adminHeaders(true),
        body: JSON.stringify(draft),
      },
    );
    const body = await response.json() as { error?: string };
    setMessage(response.ok ? "课程版本已发布。" : body.error ?? "发布失败");
    if (response.ok) await load();
  }

  function updateGenome<K extends keyof CandidateDraft["genome"]>(key: K, value: CandidateDraft["genome"][K]) {
    setDraft((current) => current ? { ...current, genome: { ...current.genome, [key]: value } } : null);
  }

  function updateUnit(index: number, title: string) {
    setDraft((current) => current ? {
      ...current,
      genome: { ...current.genome, units: current.genome.units.map((unit, unitIndex) => unitIndex === index ? { ...unit, title } : unit) },
    } : null);
  }

  function updateMapping(unitId: string, patch: Partial<CandidateDraft["mappings"][number]>) {
    setDraft((current) => current ? {
      ...current,
      mappings: current.mappings.map((mapping) => mapping.unitId === unitId ? { ...mapping, ...patch } : mapping),
    } : null);
  }

  async function saveDraft() {
    if (!selected || !draft) return;
    const response = await fetch(`/api/internal/course-intelligence/candidates/${encodeURIComponent(selected.id)}`, {
      method: "POST", headers: adminHeaders(true), body: JSON.stringify(draft),
    });
    const body = await response.json() as { error?: string };
    setMessage(response.ok ? "结构化草稿和发布检查已更新。" : body.error ?? "保存失败");
    if (response.ok) await load();
  }
}

function parseDraft(value?: string): CandidateDraft | null {
  if (!value) return null;
  try { return JSON.parse(value) as CandidateDraft; } catch { return null; }
}

function formatAnalysis(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
