"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { activityProgramUnits } from "../../lib/learning/intelligence/program-bindings";
import { ArrowUpRight, Beaker, GalleryHorizontalEnd, Link2, Paperclip, Plus, SearchCheck } from "lucide-react";
import Shell from "../_components/shell";
import {
  analyzeContentSource,
  attachWorkbenchResource,
  confirmContentFragments,
  createContentSource,
  updateContentSource,
  adoptContentSource,
  detachWorkbenchResource,
  fetchContentSources,
  fetchCurrentLearning,
  fetchInboxResources,
  fetchLearningOrchestration,
  type CurrentLearningState,
  type LearningOrchestrationState,
  type WorkspaceUserResource,
  type ContentSourceDetails,
} from "../../lib/learning/frontend";

const typeLabel: Record<WorkspaceUserResource["type"], string> = {
  link: "临时链接",
  note: "笔记",
  tool: "工具",
  resource: "外部材料",
};

export default function WorkbenchPage() {
  const [resources, setResources] = useState<WorkspaceUserResource[]>([]);
  const [contentSources, setContentSources] = useState<ContentSourceDetails[]>([]);
  const [current, setCurrent] = useState<CurrentLearningState | null>(null);
  const [orchestration, setOrchestration] = useState<LearningOrchestrationState | null>(null);
  const [type, setType] = useState<WorkspaceUserResource["type"]>("link");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ContentSourceDetails["source"] | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchInboxResources(), fetchContentSources().catch(() => []), fetchCurrentLearning().catch(() => null), fetchLearningOrchestration().catch(() => null)])
      .then(([items, sources, learning, nextOrchestration]) => { if (alive) { setResources(items); setContentSources(sources); setCurrent(learning); setOrchestration(nextOrchestration); } })
      .catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "工作台加载失败"); });
    return () => { alive = false; };
  }, []);

  const grouped = useMemo(() => Object.entries(typeLabel).map(([key, label]) => ({
    key: key as WorkspaceUserResource["type"],
    label,
    items: resources.filter((item) => item.type === key),
  })).filter((group) => group.items.length > 0), [resources]);
  const attachedIds = useMemo(() => new Set(current?.attachedResources.map((item) => item.id) ?? []), [current]);
  const currentActivity = current?.activities.find((activity) => activity.id === current.resumeState.activityId)
    ?? current?.activities.find((activity) => activity.status !== "completed")
    ?? null;

  async function refresh() {
    const [items, sources, learning, nextOrchestration] = await Promise.all([fetchInboxResources(), fetchContentSources().catch(() => []), fetchCurrentLearning().catch(() => null), fetchLearningOrchestration().catch(() => null)]);
    setResources(items);
    setContentSources(sources);
    setCurrent(learning);
    setOrchestration(nextOrchestration);
  }

  async function save() {
    if (!title.trim() && !content.trim() && !url.trim()) return;
    setBusy(true);
    setError("");
    try {
      const input = {
        title: title.trim() || content.trim().split("\n")[0]?.slice(0, 80) || url.trim(),
        type: type === "tool" ? "article" as const : type === "resource" ? "course" as const : type === "note" ? "note" as const : undefined,
        canonicalUrl: url.trim() || null,
        rawContent: content.trim() || null,
      };
      const created = await createContentSource(input);
      setSelectedSourceId(created.id);
      const hasDifferentExistingContent = created.title !== input.title || (created.rawContent ?? "") !== (input.rawContent ?? "");
      await refresh();
      setTitle(""); setContent(""); setUrl("");
      if (hasDifferentExistingContent) {
        setEditing({ ...created, title: input.title, rawContent: input.rawContent });
        setMessage("这个链接已在材料库中，已保留本次输入并打开编辑。确认保存后更新材料，避免重复导入。");
      } else setMessage("已放入工作台。它不会自动改变正式课程路线。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true); setError("");
    try {
      const result = await updateContentSource(editing.id, { title: editing.title, canonicalUrl: editing.canonicalUrl || null, rawContent: editing.rawContent || null, expectedUpdatedAt: editing.updatedAt });
      setContentSources(items => items.map(item => item.source.id === editing.id ? result : item));
      setEditing(null); setMessage("材料已更新。请重新分析、确认片段；当前路线保持原版本。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "更新失败"); }
    finally { setBusy(false); }
  }

  async function addToCourseSelection(sourceId: string, version: number) {
    setBusy(true); setError("");
    try { const result = await adoptContentSource(sourceId, version); setMessage(result.message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "加入选课范围失败"); }
    finally { setBusy(false); }
  }

  async function toggleAttachment(resourceId: string) {
    if (!currentActivity) return;
    setBusy(true);
    setError("");
    try {
      if (attachedIds.has(resourceId)) await detachWorkbenchResource(resourceId, currentActivity.id);
      else await attachWorkbenchResource(resourceId, { activityId: currentActivity.id, nodeId: currentActivity.canonicalNodeId });
      await refresh();
      setMessage(attachedIds.has(resourceId) ? "已从当前片段移除，资源仍保留在工作台。" : "已附加到当前片段，不会改变正式课程路线。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "附加失败");
    } finally {
      setBusy(false);
    }
  }

  function resourceStatus(item: WorkspaceUserResource) {
    if (attachedIds.has(item.id)) return "已附加当前片段";
    if (currentActivity?.canonicalNodeId && item.relatedNodeIds.includes(currentActivity.canonicalNodeId)) return "已关联当前节点";
    if (item.type === "resource" || item.sourceUrl) return "可转课程候选";
    return "未整理";
  }

  async function updateSource(sourceId: string, fragmentId?: string, decision: "confirmed" | "rejected" = "confirmed") {
    setBusy(true); setError("");
    try {
      const result = fragmentId ? await confirmContentFragments(sourceId, { fragmentIds: [fragmentId], decision }) : await analyzeContentSource(sourceId);
      setContentSources(items => items.map(item => item.source.id === sourceId ? result : item));
      setMessage(fragmentId ? "已保存审阅结果。重新生成路线时可查看取舍，不会改写当前路线。" : "分析完成，请逐项审阅片段。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "来源处理失败，请重试"); }
    finally { setBusy(false); }
  }

  return (
    <Shell>
      <header className="ci-topbar workbench-topbar">
        <div><p className="t2-kicker">你的材料，逐步成为路线</p><h1>把收藏变成下一步</h1><p>审阅材料片段与关联能力。确认后，在下一次路线提案中查看采用或暂缓的理由。</p></div>
      </header>
      {error && <p className="t2-error">{error}</p>}
      {message && <p className="t2-message">{message}</p>}

      <section className="wb-current-context">
        <div><span><Paperclip size={15} /> 当前处境</span><h2>{orchestration?.situation.goalHypothesis ?? currentActivity?.title ?? "还没有进行中的学习片段"}</h2><p>{orchestration?.situation.currentUncertainty ?? "确认学习路线后，控制台输入才会进入分诊、测试或成果证据。"}</p></div>
        {currentActivity && <a href="/learn">返回当前片段 <ArrowUpRight size={15} /></a>}
      </section>

      <section className="wb-capture">
        <div><p className="t2-kicker">从已有材料开始</p><h2>放入一份你拿不准的材料</h2><p>看看它实际讲什么、适不适合现在学，以及哪些内容值得进入路线。支持课程介绍、公开文章、文档和笔记。</p></div>
        <div className="wb-capture-form">
          <label>类型<select value={type} onChange={(event) => setType(event.target.value as WorkspaceUserResource["type"])}>{Object.entries(typeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>名称<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="给以后能认出来的名称" /></label>
          <label className="wide">链接（可选）<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." /></label>
          <label className="wide">材料正文或课程目录<textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="粘贴正文或目录；只填链接时尝试读取支持的公开页面。登录课程、视频内容和读取失败的页面需要补充文本。" /></label>
          <button className="t2-primary" disabled={busy || (!title.trim() && !content.trim() && !url.trim())} onClick={() => void save()}>进入来源中心</button>
        </div>
      </section>

      <section className="wb-section wb-source-objects">
        <header><div><p className="t2-kicker">你的材料库</p><h2>{contentSources.length ? `${contentSources.length} 份材料，逐份做取舍` : "添加材料后，在这里查看判断依据"}</h2></div><span>读取 → 审阅 → 选课</span></header>
        <div className="wb-material-layout">
        {contentSources.length > 0 && <nav className="wb-material-nav" aria-label="选择要审阅的材料">{contentSources.map(({ source, analysis }) => <button key={source.id} aria-pressed={source.id === (selectedSourceId ?? contentSources[0]?.source.id)} onClick={() => { setSelectedSourceId(source.id); setEditing(null); }}><Paperclip size={18} /><strong>{source.title}</strong><small>{sourceStatusLabel(source.status)} · {analysis?.fragments.length ?? 0} 个片段</small></button>)}</nav>}
        <div className="wb-triage-list">
          {contentSources.filter(item => item.source.id === (selectedSourceId ?? contentSources[0]?.source.id)).map(({ source, analysis }) => <article key={source.id}>
            <span>{sourceStatusLabel(source.status)}</span><h3>{source.title}</h3>
            <p>{analysis?.rationale ?? "来源已接入，等待内容拆解。"}</p>
            <small>{analysis ? `${analysis.mode === "model" ? "AI语义审阅" : "规则拆分 · 尚未完成语义审阅"} · ${analysis.fragments.length} 个片段 · 版本 ${analysis.version} · ${analysis.readingScope === "public_page" ? "公开页面文本" : analysis.readingScope === "provided_text" ? "仅分析提供文本" : "未读取内容"}` : "还没有分析结果"}</small>
            {analysis?.retrieval && <p><a href={analysis.retrieval.finalUrl} target="_blank" rel="noreferrer">查看实际读取页面 ↗</a> · 已分析 {analysis.retrieval.analyzedCharacters} / {analysis.retrieval.availableCharacters} 字符</p>}
            {editing?.id === source.id && <div className="wb-capture-form">
              <label className="wide">名称<input value={editing.title} onChange={event => setEditing({ ...editing, title: event.target.value })} /></label>
              <label className="wide">来源链接<input value={editing.canonicalUrl ?? ""} onChange={event => setEditing({ ...editing, canonicalUrl: event.target.value })} /></label>
              <label className="wide">正文或目录<textarea aria-label="正文或目录" value={editing.rawContent ?? ""} onChange={event => setEditing({ ...editing, rawContent: event.target.value })} /></label>
              <p>保存会使旧候选失效，已确认路线保持不变。</p>
              <button disabled={busy || !editing.title.trim()} onClick={() => void saveEdit()}>保存修改</button><button disabled={busy} onClick={() => setEditing(null)}>取消</button>
            </div>}
            {analysis?.review && <section className="wb-source-review">
              <h4>是否适合现在学</h4>
              <small>{analysis.review.goal ? `参考目标：${analysis.review.goal}` : "尚未设置学习目标，暂不判断个人适配性"}</small>
              <p>{analysis.review.suitability}</p>
              {analysis.review.findings.map((finding, index) => <div key={index} className={`wb-source-finding ${finding.kind}`}>
                <strong>{finding.kind === "claim" ? "需核验的说法" : finding.kind === "prerequisite" ? "前置要求" : "实际覆盖"}</strong>
                <blockquote>{finding.quote}</blockquote><p>{finding.explanation}</p>
              </div>)}
              {analysis.review.questions.length > 0 && <details><summary>还需要补哪些信息</summary><ul>{analysis.review.questions.map(question => <li key={question}>{question}</li>)}</ul></details>}
            </section>}
            {analysis?.limitations?.map(item => <p key={item}>{item}</p>)}
            {analysis?.fragments.map(fragment => <details key={fragment.id} className="wb-fragment"><summary>{fragment.title} · {fragment.status === "confirmed" ? "已确认" : fragment.status === "rejected" ? "已排除" : "待审阅"}</summary><p>{fragment.summary}</p>{fragment.sourceQuote && <blockquote>{fragment.sourceQuote}</blockquote>}<p>预期成果：{fragment.evidenceRequirements.join("；")}</p><small>{fragment.locator.label} · {fragment.capabilityNodeIds.length ? `关联 ${fragment.capabilityNodeIds.length} 项能力，路线提案中查看取舍` : "暂未找到有依据的能力关联"}</small>{fragment.status === "candidate" && <footer><button disabled={busy || !fragment.capabilityNodeIds.length} onClick={() => void updateSource(source.id, fragment.id, "confirmed")}>确认作为路线候选</button><button disabled={busy} onClick={() => void updateSource(source.id, fragment.id, "rejected")}>暂不采用</button></footer>}</details>)}
            <footer><button disabled={busy || editing?.id === source.id} className="t2-primary" onClick={() => void updateSource(source.id)}>{busy ? "处理中…" : analysis ? "重新分析，生成待确认版本" : "读取并分析"}</button><button disabled={busy} onClick={() => setEditing({ ...source })}>修改材料</button>{analysis?.mode === "model" && analysis.fragments.some(item => item.status === "confirmed") && <button disabled={busy} onClick={() => void addToCourseSelection(source.id, analysis.version)}>加入主课选课范围</button>}<a href="/learn">前往生成路线 ↗</a></footer>
          </article>)}
        </div>
        </div>
      </section>

      <details className="wb-secondary">
        <summary>当前路线的材料、检查与成果</summary>
      {orchestration && (
        <section className="wb-console-grid">
          <article>
            <SearchCheck size={18} />
            <span>来源中心</span>
            <strong>{orchestration.controlCenter.sourceCenter.length} 个输入</strong>
            <p>判断可信度、覆盖节点、重复关系和是否进入本周任务。</p>
          </article>
          <article>
            <Beaker size={18} />
            <span>测试机</span>
            <strong>{orchestration.controlCenter.testMachine.filter((item) => item.status === "ready").length} 个可执行检查</strong>
            <p>起点诊断、出口检查、场景题、复述解释和延迟复测。</p>
          </article>
          <article>
            <GalleryHorizontalEnd size={18} />
            <span>成果陈列室</span>
            <strong>{orchestration.controlCenter.artifactGallery.length} 个成果状态</strong>
            <p>成果不是摆设，它要证明具体能力或暴露缺口。</p>
          </article>
        </section>
      )}

      {orchestration && (
        <>
          <section className="wb-section">
            <header><div><p className="t2-kicker">来源分诊</p><h2>不是收藏，而是判断去向</h2></div><span>已确认路线</span></header>
            <div className="wb-triage-list">
              {orchestration.controlCenter.sourceCenter.map((item) => (
                <article key={item.id}>
                  <span>{verdictLabel(item.verdict)}</span>
                  <h3>{item.title}</h3>
                  <p>{item.reason}</p>
                  <small>{item.mappedNodeTitles.join("、") || "尚未映射能力节点"}</small>
                  <footer>{item.url && <a href={item.url} target="_blank" rel="noreferrer"><Link2 size={14} />打开来源</a>}<b>{item.nextAction}</b></footer>
                </article>
              ))}
            </div>
          </section>

          <section className="wb-section">
            <header><div><p className="t2-kicker">测试机</p><h2>用检查推动编排，而不是只问感觉</h2></div><span>起点 / 出口 / 复测</span></header>
            {currentActivity && activityProgramUnits[currentActivity.canonicalNodeId ?? ""] && <p><Link href={`/learn/activity/${encodeURIComponent(currentActivity.id)}`}>继续当前任务的讲解与理解检查</Link> · 答案与反馈和学习页共用。</p>}
            <div className="wb-test-grid">
              {orchestration.controlCenter.testMachine.map((item) => (
                <article key={item.id} className={item.status}>
                  <Beaker size={16} />
                  <span>{testStatusLabel(item.status)}</span>
                  <h3>{item.title}</h3>
                  <p>{item.target}</p>
                  <small>{item.reason}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="wb-section">
            <header><div><p className="t2-kicker">成果陈列室</p><h2>成果必须能证明能力</h2></div><span>待验证的成果</span></header>
            <div className="wb-artifact-grid">
              {orchestration.controlCenter.artifactGallery.map((item) => (
                <article key={item.id} className={item.state}>
                  <GalleryHorizontalEnd size={16} />
                  <span>{artifactStateLabel(item.state)}</span>
                  <h3>{item.title}</h3>
                  <p>{item.proves.join("、")}</p>
                  <small>{item.nextAction}</small>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      </details>

      {resources.length > 0 && <section className="wb-section">
        <header><div><p className="t2-kicker">历史笔记与链接</p><h2>{resources.length} 项补充记录</h2></div></header>
        {grouped.map((group) => (
          <div className="wb-resource-group" key={group.key}>
            <h3>{group.label}<small>{group.items.length}</small></h3>
            <div>
              {group.items.map((item) => <article key={item.id} className={attachedIds.has(item.id) ? "attached" : ""}><div><span>{resourceStatus(item)}</span><h4>{item.title}</h4><p>{item.content || "没有备注"}</p></div><footer>{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer"><Link2 size={14} />打开</a>}{currentActivity && <button disabled={busy} onClick={() => void toggleAttachment(item.id)}>{attachedIds.has(item.id) ? <><Paperclip size={14} />移除附加</> : <><Plus size={14} />附加到当前片段</>}</button>}</footer></article>)}
            </div>
          </div>
        ))}
        {!resources.length && <div className="wb-empty"><p>完全新手不需要先收集材料。没有输入时，Trellis 仍然可以从起点诊断生成任务包。</p></div>}
      </section>}

      <details className="wb-settings">
        <summary>高级设置与集成</summary>
        <p>内置 AI 由 Trellis 服务端提供。BYOK、私有模型和自动同步属于可选增强，不会解锁基本课程智能，也不会出现在首次学习流程中。</p>
      </details>
    </Shell>
  );
}

function verdictLabel(value: LearningOrchestrationState["controlCenter"]["sourceCenter"][number]["verdict"]) {
  if (value === "use_now") return "本周使用";
  if (value === "evidence_candidate") return "证据候选";
  if (value === "review_later") return "稍后再看";
  return "待分诊";
}

function testStatusLabel(value: LearningOrchestrationState["controlCenter"]["testMachine"][number]["status"]) {
  if (value === "ready") return "可执行";
  if (value === "done") return "已完成";
  if (value === "blocked") return "未解锁";
  return "已排期";
}

function artifactStateLabel(value: LearningOrchestrationState["controlCenter"]["artifactGallery"][number]["state"]) {
  if (value === "capability_evidence") return "能力证据";
  if (value === "portfolio_ready") return "可入作品集";
  if (value === "needs_revision") return "需修改";
  if (value === "needs_review") return "待评审";
  return "草稿";
}

function sourceStatusLabel(value: ContentSourceDetails["source"]["status"]) {
  if (value === "needs_review") return "待确认";
  if (value === "confirmed") return "已确认";
  if (value === "rejected") return "已拒绝";
  if (value === "processing") return "处理中";
  return "待分析";
}
