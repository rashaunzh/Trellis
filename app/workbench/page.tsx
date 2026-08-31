"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "../_components/shell";
import {
  addInboxResource,
  fetchInboxResources,
  type WorkspaceUserResource,
} from "../../lib/learning/frontend";

const externalSpaces = [
  { name: "NotebookLM", type: "知识库", description: "放课程原文、PDF 和来源材料；Trellis 只保存学习状态与链接。", url: "https://notebooklm.google.com/" },
  { name: "Obsidian", type: "长期笔记", description: "保存可长期复用的个人知识；不要求复制进 Trellis。", url: "https://obsidian.md/" },
  { name: "Claude Projects", type: "上下文工作区", description: "处理需要较长上下文的阅读与分析，再把关键判断带回学习反馈。", url: "https://claude.ai/" },
  { name: "Codex", type: "执行工作区", description: "用于代码、原型与项目执行；成果链接可以成为后续学习信号。", url: "https://openai.com/codex/" },
] as const;

const typeLabel: Record<WorkspaceUserResource["type"], string> = {
  link: "临时链接",
  note: "笔记",
  tool: "工具",
  resource: "外部材料",
};

export default function WorkbenchPage() {
  const [resources, setResources] = useState<WorkspaceUserResource[]>([]);
  const [type, setType] = useState<WorkspaceUserResource["type"]>("link");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchInboxResources()
      .then((items) => { if (alive) setResources(items); })
      .catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "工作台加载失败"); });
    return () => { alive = false; };
  }, []);

  const grouped = useMemo(() => Object.entries(typeLabel).map(([key, label]) => ({
    key: key as WorkspaceUserResource["type"],
    label,
    items: resources.filter((item) => item.type === key),
  })).filter((group) => group.items.length > 0), [resources]);

  async function save() {
    if (!title.trim() && !content.trim() && !url.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await addInboxResource({
        type,
        title: title.trim() || content.trim().split("\n")[0]?.slice(0, 80) || url.trim(),
        content: content.trim(),
        sourceUrl: url.trim(),
        relatedNodeIds: [],
      });
      setResources(response.resources);
      setTitle(""); setContent(""); setUrl("");
      setMessage("已放入工作台。它不会自动改变正式课程路线。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <header className="ci-topbar workbench-topbar">
        <div><p className="t2-kicker">工作台 · 辅助空间</p><h1>工具、外部知识库和暂存内容</h1><p>这里帮助你完成学习，但不决定主线课程。正式课程取舍、章节顺序和学习状态只在「学习」中管理。</p></div>
      </header>
      {error && <p className="t2-error">{error}</p>}
      {message && <p className="t2-message">{message}</p>}

      <section className="wb-capture">
        <div><p className="t2-kicker">快速暂存</p><h2>先放下，不要求现在分类到知识节点</h2><p>适合临时链接、工具、想法和外部材料。课程目录请直接在学习页交给课程智能判断。</p></div>
        <div className="wb-capture-form">
          <label>类型<select value={type} onChange={(event) => setType(event.target.value as WorkspaceUserResource["type"])}>{Object.entries(typeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>名称<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="给以后能认出来的名称" /></label>
          <label className="wide">链接（可选）<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." /></label>
          <label className="wide">备注（可选）<textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="为什么保留、以后可能怎么用。" /></label>
          <button className="t2-primary" disabled={busy || (!title.trim() && !content.trim() && !url.trim())} onClick={() => void save()}>放入工作台</button>
        </div>
      </section>

      <section className="wb-section">
        <header><div><p className="t2-kicker">外部工作空间</p><h2>内容留在最适合它的工具里</h2></div><span>不复制原文，只维护关系与状态</span></header>
        <div className="wb-space-grid">
          {externalSpaces.map((space) => <article key={space.name}><span>{space.type}</span><h3>{space.name}</h3><p>{space.description}</p><a href={space.url} target="_blank" rel="noreferrer">打开 ↗</a></article>)}
        </div>
      </section>

      <section className="wb-section">
        <header><div><p className="t2-kicker">已暂存</p><h2>{resources.length ? `${resources.length} 项辅助内容` : "还没有辅助内容"}</h2></div><span>与正式课程路线解耦</span></header>
        {grouped.map((group) => (
          <div className="wb-resource-group" key={group.key}>
            <h3>{group.label}<small>{group.items.length}</small></h3>
            <div>
              {group.items.map((item) => <article key={item.id}><div><span>{item.relatedNodeIds.length ? "旧路线关联" : "待整理"}</span><h4>{item.title}</h4><p>{item.content || "没有备注"}</p></div>{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">打开 ↗</a>}</article>)}
            </div>
          </div>
        ))}
        {!resources.length && <div className="wb-empty"><p>工作台不是必须经过的流程。没有辅助内容时，保持为空反而更清楚。</p></div>}
      </section>

      <details className="wb-settings">
        <summary>高级设置与集成</summary>
        <p>内置 AI 由 Trellis 服务端提供。BYOK、私有模型和自动同步属于可选增强，不会解锁基本课程智能，也不会出现在首次学习流程中。</p>
      </details>
    </Shell>
  );
}
