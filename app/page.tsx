"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type View = "today" | "workbench" | "projects" | "review";
type Line = "G"|"J"|"B"|"I";
type Status = "backlog"|"this_week"|"in_progress"|"pending_review"|"done";
type Role = "focus"|"support"|"maintain"|"candidate";
type Acceptance = "unreviewed"|"passed"|"rework"|"waived";
type RecordItem = { id:string; title:string; line:Line|null; projectId:string|null; scheduleRole:Role; status:Status; estimatedMinutes:number; coreAction:string; learningScope:string; executionMethod:string; completionCriteria:string; evidence:string; blockers:string; nextStep:string; aiReview:string; acceptance:Acceptance; sourceUrl:string|null; notes:string };

const fallbackRecords: RecordItem[] = [
  { id:"T-01", title:"完成 Notebook 测评方法与测试集复核", line:"J", projectId:"Notebook 专业测评", scheduleRole:"focus", status:"in_progress", estimatedMinutes:180, coreAction:"把首批测试题整理到可以直接执行的程度：来源清楚、答案清楚、证据清楚。", learningScope:"先做 L1–L3；只处理事实问答、无答案拒答、跨来源综合和引用定位。L4/L5 暂不做。", executionMethod:"打开现有测试集，检查每题是否有来源、版本、标准答案和证据 → 挑 2–3 题完整跑一遍 → 修正问题后冻结首批测试集", completionCriteria:"得到一份可以直接开测的首批测试集；每道题都有来源、答案和证据，别人按说明也能复现。", evidence:"", blockers:"先统一四个竞品的输入条件。", nextStep:"测试集冻结后，直接执行事实题和无答案题。", aiReview:"", acceptance:"unreviewed", sourceUrl:"https://allenai.org/data/qasper", notes:"" },
  { id:"T-02", title:"梳理目标 JD 的核心能力要求", line:"J", projectId:"求职准备", scheduleRole:"focus", status:"this_week", estimatedMinutes:120, coreAction:"收集 20 个目标岗位 JD，找出企业服务 AI 产品岗位真正反复要求的能力。", learningScope:"企业服务 AI 产品经理、AI 解决方案产品经理及相邻岗位。", executionMethod:"先收集 20 个 JD → 合并意思相近的职责和能力 → 标出高频要求 → 对照自己的作品找缺口", completionCriteria:"交付一张清晰的岗位能力表，包含高频要求、代表性原文、自己的现有证据和待补动作。", evidence:"", blockers:"目标公司和岗位范围可边收集边校准，不需要先想得完美。", nextStep:"把高频能力要求映射到作品和面试故事。", aiReview:"", acceptance:"unreviewed", sourceUrl:"https://www.linkedin.com/jobs/ai-product-manager-jobs-worldwide", notes:"" },
  { id:"T-03", title:"学习 Eval 指标与 Bad Case 归因", line:"G", projectId:"Notebook 专业测评", scheduleRole:"support", status:"in_progress", estimatedMinutes:120, coreAction:"只学本次 Notebook 测评会用到的指标，并把它们直接写进测评表。", learningScope:"Recall@K、引用可核验率、拒答率、冲突识别率；不扩展到完整模型评测课程。", executionMethod:"先用一句话理解每个指标 → 看一个计算例子 → 写进自己的测评表 → 给一条通过样例和一条失败样例", completionCriteria:"交付一页指标字典；每个指标都有定义、计算方式、适用题型和正反样例。", evidence:"", blockers:"延迟指标需要重复计时或产品日志，可先单独标记。", nextStep:"用指标字典跑首组测试，发现不清楚的地方再补学。", aiReview:"", acceptance:"unreviewed", sourceUrl:"https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/", notes:"" },
  { id:"T-04", title:"输出一篇测评方法复盘", line:"B", projectId:"内容实验", scheduleRole:"maintain", status:"pending_review", estimatedMinutes:60, coreAction:"把一次真实测评的做法写成新手也能看懂的复盘。", learningScope:"只讲清测试集、测试方法和评分指标，不展开完整技术架构。", executionMethod:"先写读者遇到的问题 → 用一组真实测试说明专业做法 → 放入一个 Bad Case → 总结可复用模板", completionCriteria:"交付一篇可发布草稿，读者看完能判断一份测评是否可复现。", evidence:"", blockers:"先完成一组真实测试，避免只有方法没有结果。", nextStep:"补入真实截图和 Bad Case 后发布。", aiReview:"", acceptance:"unreviewed", sourceUrl:null, notes:"" },
  { id:"T-05", title:"筛选企业知识库开源底座", line:"I", projectId:"企业知识库", scheduleRole:"candidate", status:"backlog", estimatedMinutes:120, coreAction:"比较 3–5 个成熟开源项目，选出最适合改造成企业知识库作品的底座。", learningScope:"只比较权限、文档解析、RAG、引用、反馈、评测和二次开发成本。", executionMethod:"先写清作品要证明什么 → 建候选清单 → 按同一组维度比较 → 选首选和备选", completionCriteria:"交付一张候选对比表，明确首选、备选和不选原因。", evidence:"", blockers:"本周只是候选，不挤占求职和 Notebook 主攻时间。", nextStep:"先用目标 JD 确认这个作品最需要证明的能力。", aiReview:"", acceptance:"unreviewed", sourceUrl:"https://github.com/infiniflow/ragflow", notes:"" },
];
const nav: {key:View;label:string;hint:string}[] = [
  {key:"today",label:"Today",hint:"本周行动"},{key:"workbench",label:"Workbench",hint:"统一记录"},{key:"projects",label:"Projects",hint:"项目成果"},{key:"review",label:"Review",hint:"周复盘"},
];
const statusLabel: Record<Status,string> = { backlog:"待安排", this_week:"本周待做", in_progress:"进行中", pending_review:"已交成果", done:"已完成" };
const lineLabel: Record<Line,string> = { G:"成长线", J:"成果与求职线", B:"商业线", I:"创新与想法线" };

function actionSteps(value:string) {
  return value.split(/\s*(?:→|\n)\s*/).map((step) => step.trim()).filter(Boolean);
}

function firstAction(item:RecordItem) {
  return actionSteps(item.executionMethod)[0] || item.coreAction;
}

export default function Home() {
  const [view,setView] = useState<View>("today");
  const [records,setRecords] = useState<RecordItem[]>(fallbackRecords);
  const [lineFilter,setLineFilter] = useState<"全部"|Line>("全部");
  const [query,setQuery] = useState("");
  const [modalOpen,setModalOpen] = useState(false);
  const [selectedId,setSelectedId] = useState<string|null>(null);
  const [draft,setDraft] = useState<RecordItem|null>(null);
  const [notice,setNotice] = useState("");
  const [review,setReview] = useState({ progress:"测评方法已从体验描述收敛为测试集、测试方法和评分指标三部分。", deviation:"", adjustments:"先冻结 Notebook 测试集；企业知识库继续留在候选池；保留 2 小时用于 JD 与面试准备。" });

  useEffect(() => {
    fetch("/api/records").then((r) => r.ok ? r.json() : Promise.reject()).then((data) => data.records?.length && setRecords(data.records.map((row:RecordItem) => { const example = fallbackRecords.find((item) => item.id === row.id); return example ? {...row,coreAction:example.coreAction,learningScope:example.learningScope,executionMethod:example.executionMethod,completionCriteria:example.completionCriteria,evidence:row.evidence?.startsWith("待补") ? "" : row.evidence,blockers:example.blockers,nextStep:example.nextStep,sourceUrl:row.sourceUrl || example.sourceUrl,aiReview:"",acceptance:row.acceptance || "unreviewed",notes:row.notes || ""} : {...row,coreAction:row.coreAction || "",learningScope:row.learningScope || "",executionMethod:row.executionMethod || "明确本次要完成的结果 → 打开相关资料并开始执行 → 保存成果并更新状态",completionCriteria:row.completionCriteria || "完成一份可打开的成果，并把结果补充到任务中。",evidence:row.evidence || "",blockers:row.blockers || "",nextStep:row.nextStep || "",aiReview:row.aiReview || "",acceptance:row.acceptance || "unreviewed",sourceUrl:row.sourceUrl || null,notes:row.notes || ""}; }))).catch(() => setNotice("当前展示演示数据；联网后可保存。"));
    fetch("/api/reviews?weekKey=2026-W32").then((r) => r.ok ? r.json() : Promise.reject()).then((data) => data.review && setReview({ progress:data.review.progress, deviation:data.review.deviation, adjustments:data.review.adjustments })).catch(() => undefined);
  }, []);
  const filtered = useMemo(() => records.filter((item) => (lineFilter === "全部" || item.line === lineFilter) && `${item.title}${item.projectId ?? ""}`.toLowerCase().includes(query.toLowerCase())), [records,lineFilter,query]);
  const active = records.filter((item) => item.scheduleRole !== "candidate" && item.status !== "done");
  const plannedHours = active.reduce((sum,item) => sum + item.estimatedMinutes / 60,0);
  const focusCount = active.filter((item) => item.scheduleRole === "focus").length;
  const submittedCount = records.filter((item) => item.status === "pending_review").length;

  function openRecord(item:RecordItem) { setSelectedId(item.id); setDraft({...item}); }

  async function saveRecord(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const response = await fetch(`/api/records/${draft.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(draft) }).catch(() => null);
    if (!response?.ok) return setNotice("任务详情保存失败，请稍后重试。");
    const data = await response.json();
    setRecords((items) => items.map((item) => item.id === draft.id ? {...item,...data.record} : item));
    setDraft({...draft,...data.record}); setNotice("任务详情已保存");
  }

  async function updateStatus(id:string,status:Status) {
    const before = records;
    setRecords((items) => items.map((item) => item.id === id ? {...item,status} : item));
    const response = await fetch(`/api/records/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status}) }).catch(() => null);
    if (!response?.ok) { setRecords(before); setNotice("状态保存失败，请稍后重试。"); }
    else setNotice("状态已保存");
  }

  async function createRecord(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = { title:String(form.get("title") ?? ""), recordType:"task", line:form.get("line"), projectId:String(form.get("projectId") ?? ""), scheduleRole:"support", estimatedMinutes:Number(form.get("hours"))*60, coreAction:String(form.get("coreAction") ?? ""), executionMethod:"明确本次要完成的结果 → 打开相关资料并开始执行 → 保存成果并更新状态", completionCriteria:"完成一份可打开的成果，并把结果链接或结果说明补充到任务中。", sourceUrl:String(form.get("sourceUrl") ?? "") || null, nextStep:"打开核心资料，从第一步开始。" };
    const response = await fetch("/api/records", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) }).catch(() => null);
    if (!response?.ok) return setNotice("新建失败，请检查后重试。");
    const data = await response.json(); setRecords((items) => [data.record,...items]); setModalOpen(false); setView("workbench"); setNotice("记录已新建");
  }

  async function saveReview(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/reviews", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({weekKey:"2026-W32",...review}) }).catch(() => null);
    setNotice(response?.ok ? "本周复盘已保存" : "复盘保存失败，请稍后重试。");
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">L</div><div><strong>Learning OS</strong><span>个人成长工作台</span></div></div>
      <nav className="nav-list" aria-label="主导航">{nav.map((item) => <button key={item.key} className={view === item.key ? "nav-item active" : "nav-item"} onClick={() => setView(item.key)}><span>{item.label}</span><small>{item.hint}</small></button>)}</nav>
      <div className="sidebar-foot"><p>V0.1 · 计划工作台</p><span>先替代表格，再逐步长出 AI</span></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><div><p className="eyebrow">2026 · 第 32 周</p><h1>{nav.find((item) => item.key === view)?.hint}</h1></div><div className="top-actions">{notice && <span className="notice">{notice}</span>}<button className="primary-button" onClick={() => setModalOpen(true)}>＋ 新建记录</button></div></header>

      {view === "today" && <div className="page-stack">
        <section className="goal-card"><div><p className="eyebrow">当前阶段目标</p><h2>完成 AI 产品经理转行面试准备</h2><p>求职优先，同时保留 AI 与 Business 两条长期能力轴。</p></div><div className="goal-meta"><span>两周滚动计划</span><strong>W1 / W2</strong></div></section>
        <section className="metric-grid"><article><span>本周计划</span><strong>{plannedHours}<small> / 10h</small></strong><div className="progress"><i style={{width:`${Math.min(plannedHours * 10,100)}%`}} /></div></article><article><span>主攻事项</span><strong>{focusCount}</strong><small>先完成最重要的两件事</small></article><article><span>已交成果</span><strong>{submittedCount}</strong><small>有结果，待整理或发布</small></article><article><span>已完成</span><strong>{records.filter((item) => item.status === "done").length}</strong><small>本周有效产出</small></article></section>
        <div className="two-column"><section className="panel"><div className="panel-head"><div><p className="eyebrow">Focus</p><h3>本周行动组合</h3></div><button className="text-button" onClick={() => setView("workbench")}>查看全部 →</button></div><div className="task-list">{active.map((item) => <article className="task-row action-task" key={item.id}><span className="line-badge">{item.line ? lineLabel[item.line] : "未归类"}</span><button className="task-open" onClick={() => openRecord(item)}><strong>{item.title}</strong><p><b>先做：</b>{firstAction(item)}</p></button><div className="task-meta"><span>{statusLabel[item.status]}</span><strong>{item.estimatedMinutes/60}h</strong></div></article>)}</div></section><section className="panel decision-panel"><div className="panel-head"><div><p className="eyebrow">Decision</p><h3>本周只需要判断两件事</h3></div></div><div className="decision"><span>•</span><div><strong>测试集是否可以正式开测？</strong><p>来源、答案和证据都齐全，就开始跑第一组。</p></div></div><div className="decision"><span>•</span><div><strong>企业知识库要不要本周启动？</strong><p>暂不启动，继续留在候选区。</p></div></div></section></div>
      </div>}

      {view === "workbench" && <section className="panel full-panel"><div className="panel-head wrap"><div><p className="eyebrow">All records</p><h3>统一工作台</h3><p className="section-help">这里只保留执行需要的信息：做什么、先做哪一步、用什么资料、现在是什么状态。</p></div><div className="toolbar"><input aria-label="搜索记录" placeholder="搜索任务或项目" value={query} onChange={(e) => setQuery(e.target.value)} /><div className="segmented">{(["全部","G","J","B","I"] as const).map((line) => <button key={line} className={lineFilter === line ? "selected" : ""} onClick={() => setLineFilter(line)}>{line === "全部" ? "全部任务" : lineLabel[line]}</button>)}</div></div></div><div className="record-list">{filtered.map((item) => <article className="record-card" key={item.id}><div className="record-main"><div className="record-kicker"><span>{item.line ? lineLabel[item.line] : "未归类"}</span><i>·</i><span>{item.projectId || "未关联项目"}</span><i>·</i><span>{item.estimatedMinutes/60}h</span></div><button className="record-title" onClick={() => openRecord(item)}>{item.title}<span>打开任务 →</span></button><p className="next-action"><b>下一步</b>{firstAction(item)}</p></div><div className="record-actions">{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">打开资料 ↗</a>}<select aria-label={`修改 ${item.title} 状态`} value={item.status} onChange={(e) => updateStatus(item.id,e.target.value as Status)}>{Object.entries(statusLabel).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div></article>)}{filtered.length === 0 && <div className="empty">没有匹配记录，换个关键词或新建一条。</div>}</div></section>}

      {view === "projects" && <div className="project-layout"><section className="project-hero"><p className="eyebrow">当前主攻项目 · 成果与求职线 / 成长线</p><h2>Notebook 专业测评</h2><p>验证 Gemini Notebook 能否把多源资料转化为有依据、可验证、可继续加工的成果。</p><div className="project-tags"><span>进行中</span><span>{records.filter((r) => r.projectId === "Notebook 专业测评").length} 条关联记录</span><span>下一步：冻结首批测试集</span></div></section><section className="project-grid"><article className="panel"><p className="eyebrow">Outcome</p><h3>最后要交什么</h3><p className="body-copy">专业测评报告、可复现测试集、评分规则、Bad Case 分析和一条关键机制复现链路。</p></article><article className="panel"><p className="eyebrow">Ready when</p><h3>做到什么程度就可以</h3><ul className="check-list"><li>测试集来源和版本可追溯</li><li>测试方法可由第三方复现</li><li>评分不依赖纯主观印象</li><li>结论能回到测试证据</li></ul></article><article className="panel wide"><div className="panel-head"><div><p className="eyebrow">Evidence chain</p><h3>项目产出怎么串起来</h3></div><span className="soft-pill">{submittedCount} 项已交成果</span></div><div className="evidence-flow"><span>资料来源</span><b>→</b><span>测试问题</span><b>→</b><span>模型输出</span><b>→</b><span>评分记录</span><b>→</b><span>结论</span></div></article></section></div>}

      {view === "review" && <section className="review-layout"><div className="review-intro"><p className="eyebrow">Weekly review</p><h2>不是汇报完成率，而是更新下一轮判断。</h2><p>每周保存一条独立记录，保留“计划—结果—偏差—调整”的历史。</p></div><form className="panel review-form" onSubmit={saveReview}><label>本周最大进展<textarea value={review.progress} onChange={(e) => setReview({...review,progress:e.target.value})} /></label><label>主要偏差与原因<textarea placeholder="哪些事情比预计更慢？为什么？" value={review.deviation} onChange={(e) => setReview({...review,deviation:e.target.value})} /></label><label>下周调整动作<textarea value={review.adjustments} onChange={(e) => setReview({...review,adjustments:e.target.value})} /></label><div className="form-actions"><span>保存后可在下一次打开时继续复盘</span><button className="primary-button" type="submit">保存复盘</button></div></form></section>}
    </section>

    {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setModalOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-record-title"><div className="panel-head"><div><p className="eyebrow">New record</p><h3 id="new-record-title">记下一件要做的事</h3><p className="section-help">不用写编号和评判标准，系统会先生成基础步骤与完成结果。</p></div><button className="close-button" aria-label="关闭" onClick={() => setModalOpen(false)}>×</button></div><form onSubmit={createRecord} className="new-form"><label>任务名称<input name="title" required autoFocus placeholder="例如：完成企业知识库底座对比" /></label><div className="form-grid simple"><label>属于哪条线<select name="line" defaultValue="G">{(["G","J","B","I"] as Line[]).map((line) => <option key={line} value={line}>{lineLabel[line]}</option>)}</select></label><label>预计时间<input name="hours" type="number" min="0.5" max="20" step="0.5" defaultValue="1" /></label></div><label>关联项目<input name="projectId" required placeholder="例如：Notebook 专业测评" /></label><label>你想完成什么<textarea name="coreAction" required placeholder="用一句话写清想得到的结果，后续步骤和完成标准由系统补齐" /></label><label>相关资料链接（选填）<input name="sourceUrl" type="url" placeholder="https://..." /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>取消</button><button className="primary-button" type="submit">创建任务</button></div></form></section></div>}

    {selectedId && draft && <div className="drawer-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && (setSelectedId(null),setDraft(null))}><aside className="task-drawer" role="dialog" aria-modal="true" aria-labelledby="task-detail-title"><div className="drawer-head"><div><p className="eyebrow">{draft.line ? lineLabel[draft.line] : "任务"} · {draft.projectId || "未关联项目"}</p><h2 id="task-detail-title">{draft.title}</h2></div><button className="close-button" aria-label="关闭任务详情" onClick={() => (setSelectedId(null),setDraft(null))}>×</button></div><form className="detail-form simple-detail" onSubmit={saveRecord}><section className="quick-status"><div><span>当前状态</span><select value={draft.status} onChange={(e) => setDraft({...draft,status:e.target.value as Status})}>{Object.entries(statusLabel).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><span>预计投入</span><strong>{draft.estimatedMinutes / 60} 小时</strong></div></section><section className="task-section"><p className="task-label">这项任务要做什么</p><textarea className="plain-editor" value={draft.coreAction} onChange={(e) => setDraft({...draft,coreAction:e.target.value})} /></section><section className="task-section"><p className="task-label">照着做</p><div className="step-list">{actionSteps(draft.executionMethod).map((step,index) => <div key={`${step}-${index}`}><span aria-hidden="true">•</span><p>{step}</p></div>)}</div></section><section className="task-section"><p className="task-label">用到的资料</p>{draft.sourceUrl ? <a className="resource-card" href={draft.sourceUrl} target="_blank" rel="noreferrer"><span><b>核心资料</b><small>{draft.learningScope || "打开资料，按任务范围查阅即可，不需要从头学完。"}</small></span><strong>打开 ↗</strong></a> : <div className="resource-empty">这项任务暂时不需要额外资料，直接开始即可。</div>}</section><section className="task-section deliverable-card"><p className="task-label">最后交什么</p><p>{draft.completionCriteria}</p></section>{draft.blockers && <section className="task-section blocker-card"><p className="task-label">可能卡在哪里</p><p>{draft.blockers}</p></section>}<section className="task-section"><p className="task-label">完成后，把成果放这里</p><input value={draft.evidence} onChange={(e) => setDraft({...draft,evidence:e.target.value})} placeholder="粘贴文档、仓库或成果链接；没有链接也可写一句结果" /></section><details className="advanced-edit"><summary>调整任务信息</summary><div className="advanced-fields"><label>任务名称<input value={draft.title} onChange={(e) => setDraft({...draft,title:e.target.value})} /></label><div className="detail-grid"><label>主线<select value={draft.line ?? "G"} onChange={(e) => setDraft({...draft,line:e.target.value as Line})}>{(["G","J","B","I"] as Line[]).map((line) => <option key={line} value={line}>{lineLabel[line]}</option>)}</select></label><label>预计分钟<input type="number" min="0" step="30" value={draft.estimatedMinutes} onChange={(e) => setDraft({...draft,estimatedMinutes:Number(e.target.value)})} /></label></div><label>执行步骤<textarea value={draft.executionMethod} onChange={(e) => setDraft({...draft,executionMethod:e.target.value})} /></label><label>核心资料链接<input type="url" value={draft.sourceUrl ?? ""} onChange={(e) => setDraft({...draft,sourceUrl:e.target.value || null})} /></label><label>最后交付结果<textarea value={draft.completionCriteria} onChange={(e) => setDraft({...draft,completionCriteria:e.target.value})} /></label></div></details><div className="drawer-actions"><span>步骤和结果已预填，你只需执行并更新状态。</span><button className="primary-button" type="submit">保存</button></div></form></aside></div>}
  </main>;
}
