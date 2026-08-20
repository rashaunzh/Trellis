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
  proposeAdjustment,
  skipNode,
  confirmMastery,
  type Workspace,
  type WorkspaceNodeProgress,
} from "../../lib/learning/frontend";

export default function GrowPage() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"weekly_light" | "activity_replan" | "route_revision">("weekly_light");
  const [adjustmentReason, setAdjustmentReason] = useState("");

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
          <span>当前路线旁边可选的分支</span>
          {ws.adjacentBranches.map((b) => (
            <em key={b.id}>{b.name}：{b.description}</em>
          ))}
        </div>
      )}

      {/* 三色节点脉络图（树枝状分叉） */}
      <section className="t2-section">
        <header>
          <h3>当前路线脉络</h3>
          <div className="t2-legend">
            <i className="st-unstarted" />未点亮
            <i className="st-growing" />成长中
            <i className="st-pending_confirmation" />待确认
            <i className="st-validated" />已验证
          </div>
        </header>
        <TreeMap
          ws={ws}
          selectedNode={selectedNode}
          onSelect={(nodeId) => setSelectedNode(nodeId === selectedNode ? null : nodeId)}
          onSkip={(nodeId) => void run(() => skipNode(nodeId), "已跳过，生成验证活动")}
          busy={busy}
        />
      </section>

      {/* 节点详情 */}
      {selected && (
        <section className="t2-section">
          <header><h3>{selected.title}</h3><span className="t2-muted">{selected.nodeId}</span></header>
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
            {selected.status === "pending_confirmation" && (
              <div className="t2-mastery-confirm">
                <p className="t2-hint">系统评估通过，请确认或纠正「{selected.title}」的掌握判断。</p>
                <button
                  className="t2-primary"
                  disabled={busy}
                  onClick={() => void run(() => confirmMastery(selected.nodeId, { decision: "confirmed" }), "已确认掌握，节点进入已验证")}
                >
                  确认掌握
                </button>
                <button
                  className="t2-secondary"
                  disabled={busy}
                  onClick={() => void run(() => confirmMastery(selected.nodeId, { decision: "corrected", note: "尚未完全掌握" }), "已纠正，节点回到成长中并生成补强建议")}
                >
                  纠正（尚未掌握）
                </button>
              </div>
            )}
            {selected.status !== "validated" && selected.status !== "pending_confirmation" && (
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
          <h3>调整提案</h3>
          <span className="t2-muted">用户可提出调整，系统先保存为待确认，不直接改路线。</span>
        </header>
        <div className="t2-adjust-form">
          <label>
            调整类型
            <select value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value as typeof adjustmentType)}>
              <option value="weekly_light">本周节奏微调</option>
              <option value="activity_replan">活动重新编排</option>
              <option value="route_revision">路线/分支调整</option>
            </select>
          </label>
          <label>
            为什么要调整？
            <textarea
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              placeholder="例如：这周只有碎片时间；我已经会提示词了，想验证后跳到 RAG；当前任务太抽象，需要更多示例。"
            />
          </label>
          <button
            className="t2-primary"
            disabled={busy || !adjustmentReason.trim()}
            onClick={() => void run(
              () => proposeAdjustment({ adjustmentType, reason: adjustmentReason }).then((next) => {
                setAdjustmentReason("");
                return next;
              }),
              "已生成待确认调整提案",
            )}
          >
            生成调整提案
          </button>
        </div>
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
  dueReview,
  active,
  onSelect,
  onSkip,
  busy,
}: {
  progress: WorkspaceNodeProgress;
  dueReview: boolean;
  active: boolean;
  onSelect: () => void;
  onSkip: () => void;
  busy: boolean;
}) {
  const nodeLabel = progress.title;
  return (
    <article className={`t2-node-card ${active ? "active" : ""}`} onClick={onSelect}>
      <i className={`t2-node-dot st-${progress.status}`} />
      <div>
        <b>{nodeLabel}</b>
        <span>{NODE_STATUS_TEXT[progress.status]}{progress.confidence > 0 ? ` · 等级 ${progress.confidence}` : ""}</span>
        {dueReview && <em className="t2-due-badge">待复测</em>}
      </div>
      {active && progress.status !== "validated" && (
        <button className="t2-mini" disabled={busy} onClick={(e) => { e.stopPropagation(); onSkip(); }}>
          跳学
        </button>
      )}
    </article>
  );
}

// ── 树枝状脉络图 ────────────────────────────────────
// 横向树：root 在左，按前置关系向右分叉。层 = 前置深度（同层节点纵向排布），
// 层间用 SVG 贝塞尔曲线连接（仿树枝分叉），节点状态用三色圆点。

const NODE_W = 200;   // 节点卡宽度（px）
const NODE_H = 64;    // 节点卡高度（px）
const LEVEL_GAP = 150; // 层间距（px）
const NODE_GAP = 28;   // 层内节点间距（px）

function TreeMap({
  ws,
  selectedNode,
  onSelect,
  onSkip,
  busy,
}: {
  ws: Workspace;
  selectedNode: string | null;
  onSelect: (nodeId: string) => void;
  onSkip: (nodeId: string) => void;
  busy: boolean;
}) {
  const levels = buildTree(ws);
  if (levels.length === 0) return <p className="t2-empty">暂无节点。</p>;

  // 计算每个节点的 (col, row)
  const pos = new Map<string, { col: number; row: number }>();
  levels.forEach((level, col) => {
    level.forEach((nodeId, row) => pos.set(nodeId, { col, row }));
  });

  // 画布尺寸
  const cols = levels.length;
  const maxRows = Math.max(...levels.map((l) => l.length));
  const width = cols * NODE_W + (cols - 1) * LEVEL_GAP + 40;
  const height = maxRows * NODE_H + (maxRows - 1) * NODE_GAP + 40;

  // 节点中心坐标
  const center = (nodeId: string) => {
    const { col, row } = pos.get(nodeId)!;
    const colWidth = NODE_W + LEVEL_GAP;
    const x = 20 + col * colWidth + NODE_W / 2;
    const rowsInCol = levels[col].length;
    const y = 20 + (row + 0.5) * (NODE_H + NODE_GAP) - NODE_GAP / 2 + (height - rowsInCol * (NODE_H + NODE_GAP)) / 2;
    return { x, y };
  };

  // 树枝曲线：父节点右缘 → 子节点左缘（贝塞尔，横向分叉）
  const branchPath = (from: string, to: string) => {
    const a = center(from);
    const b = center(to);
    const dx = (b.x - a.x) / 2;
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  };

  const prereqEdges = ws.edges.filter((e) => e.relationType === "prerequisite" && pos.has(e.sourceNodeId) && pos.has(e.targetNodeId));

  return (
    <div className="t2-treemap" style={{ width, height }}>
      <svg className="t2-treemap-svg" width={width} height={height}>
        {prereqEdges.map((e) => (
          <path
            key={`${e.sourceNodeId}->${e.targetNodeId}`}
            d={branchPath(e.sourceNodeId, e.targetNodeId)}
            className="t2-treemap-edge"
            fill="none"
          />
        ))}
      </svg>
      {ws.nodeProgress.map((progress) => {
        const { x, y } = center(progress.nodeId);
        return (
          <div
            key={progress.nodeId}
            className="t2-treemap-node"
            style={{ left: x - NODE_W / 2, top: y - NODE_H / 2, width: NODE_W }}
          >
            <NodeCard
              progress={progress}
              dueReview={ws.dueReviews.some((d) => d.nodeId === progress.nodeId)}
              active={selectedNode === progress.nodeId}
              onSelect={() => onSelect(progress.nodeId)}
              onSkip={() => onSkip(progress.nodeId)}
              busy={busy}
            />
          </div>
        );
      })}
    </div>
  );
}

// 树状脉络：按前置关系分层。roots = 无 prerequisite 依赖的节点；
// 后续层 = 其前置都已出现在前面层的节点。层内按原始顺序稳定。
function buildTree(ws: Workspace): string[][] {
  const nodeIds = ws.nodeProgress.map((p) => p.nodeId);
  const prereqByTarget = new Map<string, string[]>();
  for (const edge of ws.edges) {
    if (edge.relationType !== "prerequisite") continue;
    const list = prereqByTarget.get(edge.targetNodeId) ?? [];
    list.push(edge.sourceNodeId);
    prereqByTarget.set(edge.targetNodeId, list);
  }

  const levels: string[][] = [];
  const placed = new Set<string>();
  let remaining = [...nodeIds];
  while (remaining.length > 0) {
    const level = remaining.filter((id) =>
      (prereqByTarget.get(id) ?? []).every((p) => placed.has(p)),
    );
    if (level.length === 0) {
      // 环或孤立节点：剩余全部作为最后一层，避免死循环
      levels.push(remaining);
      break;
    }
    levels.push(level);
    for (const id of level) placed.add(id);
    remaining = remaining.filter((id) => !placed.has(id));
  }
  return levels;
}
