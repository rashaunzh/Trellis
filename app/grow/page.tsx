"use client";

// 成长页：统一成长地图 —— 当前路线、相邻分支、三色节点状态、证据、调整记录
import { useEffect, useState } from "react";
import Shell from "../_components/shell";
import {
  ADJUSTMENT_TYPE_TEXT,
  EVIDENCE_STATUS_TEXT,
  NODE_STATUS_TEXT,
  confirmAdjustment,
  fetchWorkspace,
  skipNode,
  type Workspace,
  type WorkspaceNodeProgress,
} from "../../lib/learning/frontend";

export default function GrowPage() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    fetchWorkspace()
      .then((next) => { if (alive) setWs(next); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "加载失败"); });
    return () => { alive = false; };
  }, []);

  async function run(action: () => Promise<Workspace>, successMessage?: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setWs(await action());
      if (successMessage) setMessage(successMessage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  if (!ws) {
    return (
      <Shell>
        <div className="t2-center"><b className="t2-loading">Trellis</b><p>正在加载成长地图……</p></div>
      </Shell>
    );
  }
  if (!ws.profile || ws.profile.status !== "confirmed") {
    return (
      <Shell>
        <div className="t2-center">
          <h1>还没有学习地图</h1>
          <p>先在「学习」页完成诊断并确认路线，这里会显示你的成长地图。</p>
          <a className="t2-primary t2-link" href="/learn">去学习页开始</a>
        </div>
      </Shell>
    );
  }

  const progressById = new Map(ws.nodeProgress.map((p) => [p.nodeId, p]));
  const selected = selectedNode ? progressById.get(selectedNode) : null;
  const validatedCount = ws.nodeProgress.filter((p) => p.status === "validated").length;
  const growingCount = ws.nodeProgress.filter((p) => p.status === "growing").length;

  return (
    <Shell>
      <div className="t2-topbar">
        <div>
          <p className="t2-kicker">成长 · 统一学习地图</p>
          <h1>{ws.route?.title}</h1>
        </div>
        <div className="t2-map-stats">
          <span>已验证 <b>{validatedCount}</b></span>
          <span>成长中 <b>{growingCount}</b></span>
          <span>未点亮 <b>{ws.nodeProgress.length - validatedCount - growingCount}</b></span>
        </div>
      </div>

      {message && <p className="t2-message">{message}</p>}
      {error && <p className="t2-error">{error}</p>}

      {/* 相邻分支 */}
      {ws.adjacentBranches.length > 0 && (
        <div className="t2-map-adjacent">
          <span>相邻分支</span>
          {ws.adjacentBranches.map((b) => (
            <em key={b.id}>{b.name} — {b.description}</em>
          ))}
        </div>
      )}

      {/* 三色节点地图 */}
      <section className="t2-section">
        <header>
          <h3>当前路线</h3>
          <div className="t2-legend">
            <i className="st-unstarted" />未点亮
            <i className="st-growing" />成长中
            <i className="st-validated" />已验证
          </div>
        </header>
        <div className="t2-node-map">
          {ws.nodeProgress.map((progress) => (
            <NodeCard
              key={progress.nodeId}
              progress={progress}
              active={selectedNode === progress.nodeId}
              onSelect={() => setSelectedNode(progress.nodeId === selectedNode ? null : progress.nodeId)}
              onSkip={() => void run(() => skipNode(progress.nodeId), "已跳过，生成验证活动")}
              busy={busy}
            />
          ))}
        </div>
      </section>

      {/* 节点详情 */}
      {selected && (
        <section className="t2-section">
          <header><h3>节点详情</h3><span className="t2-muted">{selected.nodeId}</span></header>
          <div className="t2-node-detail">
            <div className="t2-node-detail-row">
              <span>状态</span>
              <b className={`t2-status st-${selected.status}`}>{NODE_STATUS_TEXT[selected.status]}</b>
            </div>
            <div className="t2-node-detail-row">
              <span>熟练等级</span>
              <b>{selected.confidence} / 3</b>
            </div>
            <div className="t2-node-detail-row">
              <span>验证时间</span>
              <b>{selected.lastValidatedAt ?? "—"}</b>
            </div>
            <div className="t2-node-detail-row">
              <span>支持证据</span>
              <b>{selected.supportingEvidenceIds.length} 条</b>
            </div>
            {/* 该节点的证据 */}
            <div className="t2-node-evidence">
              <span className="t2-drawer-label">已提交证据</span>
              {ws.evidence.filter((e) => e.nodeId === selected.nodeId).map((e) => (
                <div key={e.id} className="t2-evidence-row">
                  <p>{e.content.slice(0, 120)}{e.content.length > 120 ? "…" : ""}</p>
                  <em>{EVIDENCE_STATUS_TEXT[e.status]}</em>
                </div>
              ))}
              {ws.evidence.filter((e) => e.nodeId === selected.nodeId).length === 0 && (
                <p className="t2-empty">暂无证据，完成学习活动并提交。</p>
              )}
            </div>
            {selected.status !== "validated" && (
              <button
                className="t2-secondary"
                disabled={busy}
                onClick={() => void run(() => skipNode(selected.nodeId), "已跳过，生成验证活动")}
              >
                跳学（进入验证路径）
              </button>
            )}
          </div>
        </section>
      )}

      {/* 调整记录 */}
      <section className="t2-section">
        <header>
          <h3>调整记录</h3>
          <span className="t2-muted">路线变化可追溯、可确认</span>
        </header>
        <div className="t2-adjust-list">
          {ws.adjustments.map((a) => (
            <div key={a.id} className={`t2-adjust ${a.status === "proposed" ? "proposed" : ""}`}>
              <b>{ADJUSTMENT_TYPE_TEXT[a.adjustmentType]}</b>
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
    </Shell>
  );
}

function NodeCard({
  progress,
  active,
  onSelect,
  onSkip,
  busy,
}: {
  progress: WorkspaceNodeProgress;
  active: boolean;
  onSelect: () => void;
  onSkip: () => void;
  busy: boolean;
}) {
  const nodeLabel = progress.nodeId.split(".").pop() ?? progress.nodeId;
  return (
    <article className={`t2-node-card ${active ? "active" : ""}`} onClick={onSelect}>
      <i className={`t2-node-dot st-${progress.status}`} />
      <div>
        <b>{nodeLabel}</b>
        <span>{NODE_STATUS_TEXT[progress.status]}{progress.confidence > 0 ? ` · 等级 ${progress.confidence}` : ""}</span>
      </div>
      {active && progress.status !== "validated" && (
        <button className="t2-mini" disabled={busy} onClick={(e) => { e.stopPropagation(); onSkip(); }}>
          跳学
        </button>
      )}
    </article>
  );
}
