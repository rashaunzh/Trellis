"use client";

// 工作台：收集箱、系统推荐资源、工具卡片 —— 资源/工具与学习节点的映射
import { useEffect, useState } from "react";
import Shell from "../_components/shell";
import { fetchWorkspace, type Workspace } from "../../lib/learning/frontend";

export default function WorkbenchPage() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [filter, setFilter] = useState("all");

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

  return (
    <Shell>
      <div className="t2-topbar">
        <div>
          <p className="t2-kicker">工作台 · 资源与工具</p>
          <h1>不是收藏夹，是映射到节点的可用材料</h1>
        </div>
      </div>

      {/* 收集箱提示 */}
      <div className="t2-inbox-note">
        <b>收集箱</b>
        <p>
          用户材料、链接与想法先进入这里做映射检查，不直接改变正式地图。
          MVP 阶段以系统推荐资源为主，材料登记能力在后续版本开放。
        </p>
      </div>

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
                  <em>对应节点：{r.nodeId.split(".").pop()}</em>
                </div>
                <h4>{r.title}</h4>
                <p>{r.summary}</p>
                <small>学习用途：{r.usage}</small>
              </div>
              {r.url && <a href={r.url} target="_blank" rel="noreferrer">打开 ↗</a>}
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
                <span>对应节点：{t.nodeId.split(".").pop()}</span>
              </header>
              <p>{t.description}</p>
              <div className="t2-tool-usage">
                <span>适合在</span>
                <strong>{t.activityContext}</strong>
              </div>
              <footer>
                <em>{t.usage}</em>
                {t.url && <a href={t.url} target="_blank" rel="noreferrer">打开 ↗</a>}
              </footer>
            </article>
          ))}
          {tools.length === 0 && <p className="t2-empty">暂无工具推荐。</p>}
        </div>
      </section>
    </Shell>
  );
}
