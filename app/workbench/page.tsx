"use client";

// 工作台：收集箱、系统推荐资源、工具卡片 —— 资源/工具与学习节点的映射
import { useEffect, useState } from "react";
import Shell from "../_components/shell";
import { fetchWorkspace, nodeTitle, type Workspace } from "../../lib/learning/frontend";

type InboxItem = {
  id: string;
  type: "link" | "note" | "tool" | "resource";
  title: string;
  content: string;
  mappedNodeId: string;
};

export default function WorkbenchPage() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [filter, setFilter] = useState("all");
  const [inboxType, setInboxType] = useState<InboxItem["type"]>("link");
  const [inboxText, setInboxText] = useState("");
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [workbenchMessage, setWorkbenchMessage] = useState("");

  useEffect(() => {
    let alive = true;
    fetchWorkspace()
      .then((next) => { if (alive) setWs(next); })
      .catch(() => { if (alive) setWs(null); });
    return () => { alive = false; };
  }, []);

  if (!ws) {
    return (
      <Shell>
        <div className="t2-center"><b className="t2-loading">Trellis</b><p>正在加载工作台……</p></div>
      </Shell>
    );
  }
  if (!ws.profile) {
    return (
      <Shell>
        <div className="t2-center">
          <h1>还没有学习地图</h1>
          <p>先在「学习」页完成诊断，工作台会展示与你路线匹配的资源与工具。</p>
          <a className="t2-primary t2-link" href="/learn">去学习页开始</a>
        </div>
      </Shell>
    );
  }

  const resources = ws.workbench.resources;
  const tools = ws.workbench.tools;
  const sourceTypes = [...new Set(resources.map((r) => r.sourceType))];
  const visibleResources = filter === "all" ? resources : resources.filter((r) => r.sourceType === filter);
  const defaultNodeId = ws.nodeProgress.find((p) => p.status !== "validated")?.nodeId ?? ws.nodeProgress[0]?.nodeId ?? "unmapped";

  function addInboxItem(input: Omit<InboxItem, "id">) {
    setInboxItems((items) => [
      { ...input, id: `inbox-${Date.now()}-${items.length}` },
      ...items,
    ]);
  }

  return (
    <Shell>
      <div className="t2-topbar">
        <div>
          <p className="t2-kicker">工作台 · 资源与工具</p>
          <h1>不是收藏夹，是映射到节点的可用材料</h1>
        </div>
      </div>

      {workbenchMessage && <p className="t2-message">{workbenchMessage}</p>}

      {/* 收集箱 */}
      <div className="t2-inbox-panel">
        <div>
          <b>收集箱</b>
          <p>
            用户材料、链接与想法先进入这里做映射检查，不直接改变正式地图。
            目的不是收藏，而是降低你回到飞书/网页/工具里找材料的频率。
          </p>
        </div>
        <div className="t2-inbox-form">
          <select value={inboxType} onChange={(e) => setInboxType(e.target.value as InboxItem["type"])}>
            <option value="link">链接/课程</option>
            <option value="note">想法/笔记</option>
            <option value="tool">工具</option>
            <option value="resource">材料</option>
          </select>
          <textarea
            value={inboxText}
            onChange={(e) => setInboxText(e.target.value)}
            placeholder="粘贴链接，或写下你刚收集到的材料/想法。"
          />
          <button
            className="t2-primary"
            disabled={!inboxText.trim()}
            onClick={() => {
              addInboxItem({
                type: inboxType,
                title: inboxText.trim().split("\n")[0].slice(0, 48),
                content: inboxText.trim(),
                mappedNodeId: defaultNodeId,
              });
              setInboxText("");
              setWorkbenchMessage("已加入收集箱，并建议映射到当前未验证节点。");
            }}
          >
            加入收集箱
          </button>
        </div>
        <div className="t2-inbox-list">
          {inboxItems.map((item) => (
            <article key={item.id} className="t2-inbox-item">
              <span>{item.type}</span>
              <b>{item.title}</b>
              <p>{item.content}</p>
              <em>建议映射：{nodeTitle(item.mappedNodeId)}</em>
            </article>
          ))}
          {inboxItems.length === 0 && <p className="t2-empty">还没有临时材料。先丢一个链接或想法进来试试。</p>}
        </div>
      </div>

      <section className="t2-section">
        <header>
          <h3>AI 接入状态</h3>
          <span className="t2-muted">MVP 先保留接口边界，默认使用规则 agent；后续可接入 BYOK 或服务端模型。</span>
        </header>
        <div className="t2-ai-panel">
          <div>
            <b>当前：规则 Agent</b>
            <p>Planner / Activity Composer / Evidence Evaluator / Adjustment Advisor 已按接口拆开，可替换成 LLM。</p>
          </div>
          <button
            className="t2-secondary"
            onClick={() => setWorkbenchMessage("AI 登录/API Key 管理尚未开放：下一步应做服务端密钥保存、模型选择和调用日志。")}
          >
            查看接入说明
          </button>
        </div>
      </section>

      {/* 资源列表（含映射） */}
      <section className="t2-section">
        <header>
          <h3>系统推荐资源</h3>
          <div className="t2-filter">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>全部</button>
            {sourceTypes.map((t) => (
              <button key={t} className={filter === t ? "active" : ""} onClick={() => setFilter(t)}>{t}</button>
            ))}
          </div>
        </header>
        <div className="t2-resource-list">
          {visibleResources.map((r) => (
            <article key={r.resourceId} className="t2-resource-card">
              <div className="t2-resource-main">
                <div className="t2-resource-head">
                  <span>{r.sourceType} · 可信度 {r.credibilityLevel}/5</span>
                  <em>对应节点：{nodeTitle(r.nodeId)}</em>
                </div>
                <h4>{r.title}</h4>
                <p>{r.summary}</p>
                <small>学习用途：{r.usage}</small>
              </div>
              <div className="t2-resource-actions">
                <button
                  className="t2-mini"
                  onClick={() => {
                    addInboxItem({
                      type: "resource",
                      title: r.title,
                      content: `${r.summary}\n用途：${r.usage}`,
                      mappedNodeId: r.nodeId,
                    });
                    setWorkbenchMessage("资源已加入收集箱。");
                  }}
                >
                  加入收集箱
                </button>
                {r.url && <a href={r.url} target="_blank" rel="noreferrer">打开 ↗</a>}
              </div>
            </article>
          ))}
          {visibleResources.length === 0 && <p className="t2-empty">该类型暂无推荐资源。</p>}
        </div>
      </section>

      {/* 工具卡片 */}
      <section className="t2-section">
        <header>
          <h3>工具卡片</h3>
          <span className="t2-muted">每个工具说明：是什么、对应节点、适合在哪个活动使用</span>
        </header>
        <div className="t2-tool-grid">
          {tools.map((t) => (
            <article key={t.toolId} className="t2-tool-card">
              <header>
                <b>{t.name}</b>
                <span>对应节点：{nodeTitle(t.nodeId)}</span>
              </header>
              <p>{t.description}</p>
              <div className="t2-tool-usage">
                <span>适合在</span>
                <strong>{t.activityContext}</strong>
              </div>
              <footer>
                <em>{t.usage}</em>
                <div className="t2-tool-actions">
                  <button
                    className="t2-mini"
                    onClick={() => {
                      addInboxItem({
                        type: "tool",
                        title: t.name,
                        content: `${t.description}\n适合在：${t.activityContext}`,
                        mappedNodeId: t.nodeId,
                      });
                      setWorkbenchMessage("工具已加入收集箱。");
                    }}
                  >
                    本周使用
                  </button>
                  {t.url && <a href={t.url} target="_blank" rel="noreferrer">打开 ↗</a>}
                </div>
              </footer>
            </article>
          ))}
          {tools.length === 0 && <p className="t2-empty">暂无工具推荐。</p>}
        </div>
      </section>
    </Shell>
  );
}
