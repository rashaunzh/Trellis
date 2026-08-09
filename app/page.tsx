"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  contextPacket,
  firstStep,
  horizonMeta,
  lineMeta,
  normalizeHorizon,
  routeStages,
  starterConcepts,
  starterRecords,
  stars,
  type ConceptCard,
  type Horizon,
  type Line,
  type TrellisRecord,
} from "../lib/trellis";

type View = "week" | "routes" | "projects" | "concepts" | "tools" | "review";
type Review = { progress:string; deviation:string; feedback:string; adjustments:string };

const nav: Array<{ key:View; label:string; hint:string }> = [
  { key:"week", label:"本周", hint:"阶段看板" },
  { key:"routes", label:"路线", hint:"长期地图" },
  { key:"projects", label:"项目", hint:"成果链路" },
  { key:"concepts", label:"概念", hint:"闪卡记忆" },
  { key:"tools", label:"工具", hint:"工作台地图" },
  { key:"review", label:"复盘", hint:"更新判断" },
];
const boardHorizons: Horizon[] = ["active", "near", "later", "paused"];
const toolMap = [
  { name:"Trellis", role:"路线、任务、关系、决策、证据索引与连续记忆", write:"正式状态与已确认结论", action:"在这里决定下一步" },
  { name:"NotebookLM / Gemini", role:"基于给定资料的阅读、问答、引用和综合", write:"页面链接、关键结论与证据", action:"打开资料工作台" },
  { name:"ChatGPT", role:"开放讨论、解释、方案比较和计划校准", write:"结论、分歧、待确认提案", action:"粘贴任务上下文" },
  { name:"Codex", role:"仓库、代码、结构化记忆、测试与执行", write:"提交、测试证据和 handoff", action:"推进可验证实现" },
  { name:"Obsidian / Hermes", role:"信息流 Inbox、剪藏、去重、分类和原文", write:"来源链接与候选摘要", action:"不在 Trellis 重复剪藏" },
  { name:"Anki（以后）", role:"概念闪卡的间隔复习", write:"熟悉度与复习记录", action:"从概念卡导出" },
];

const defaultReview: Review = {
  progress:"产品骨架和路线记忆已经确定，接下来用 Notebook 测评验证完整链路。",
  deviation:"",
  feedback:"",
  adjustments:"本周只推进 Notebook 测评的前两步；其余路线保持可见但不承诺。",
};

function currentWeekKey() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getFullYear(),0,1));
  const days = Math.floor((Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()) - first.getTime()) / 86400000);
  return `${now.getFullYear()}-W${String(Math.ceil((days + first.getUTCDay() + 1) / 7)).padStart(2,"0")}`;
}

function cleanRecord(row:Partial<TrellisRecord>): TrellisRecord {
  const fallback = starterRecords.find((item) => item.id === row.id);
  const base = fallback ?? starterRecords[0];
  return {
    ...base,
    ...row,
    id:String(row.id ?? base.id),
    title:String(row.title ?? base.title),
    line:(row.line ?? base.line) as Line,
    module:String(row.module ?? base.module ?? ""),
    projectId:String(row.projectId ?? base.projectId ?? ""),
    status:normalizeHorizon(String(row.status ?? base.status)),
    estimatedMinutes:Math.max(15,Number(row.estimatedMinutes ?? base.estimatedMinutes)),
    actualMinutes:Math.max(0,Number(row.actualMinutes ?? 0)),
    coreAction:String(row.coreAction ?? base.coreAction ?? ""),
    learningScope:String(row.learningScope ?? base.learningScope ?? ""),
    executionMethod:String(row.executionMethod ?? base.executionMethod ?? ""),
    completionCriteria:String(row.completionCriteria ?? base.completionCriteria ?? ""),
    evidence:String(row.evidence ?? ""),
    blockers:String(row.blockers ?? base.blockers ?? ""),
    nextStep:String(row.nextStep ?? base.nextStep ?? ""),
    aiReview:String(row.aiReview ?? ""),
    sourceUrl:row.sourceUrl || null,
    notes:String(row.notes ?? ""),
  };
}

export default function Home() {
  const [view,setView] = useState<View>("week");
  const [records,setRecords] = useState<TrellisRecord[]>(starterRecords);
  const [lineFilter,setLineFilter] = useState<"all"|Line>("all");
  const [selected,setSelected] = useState<TrellisRecord|null>(null);
  const [concepts,setConcepts] = useState<ConceptCard[]>(starterConcepts);
  const [conceptOpen,setConceptOpen] = useState(false);
  const [conceptFilter,setConceptFilter] = useState<"learning"|"familiar">("learning");
  const [newOpen,setNewOpen] = useState(false);
  const [notice,setNotice] = useState("");
  const [review,setReview] = useState<Review>(defaultReview);
  const [routeLine,setRouteLine] = useState<Line>("G");
  const [project,setProject] = useState("Notebook 测评");
  const weekKey = currentWeekKey();

  useEffect(() => {
    fetch("/api/records")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        const remote = (data.records ?? []).map(cleanRecord) as TrellisRecord[];
        const ids = new Set(remote.map((item) => item.id));
        setRecords([...remote,...starterRecords.filter((item) => !ids.has(item.id))]);
      })
      .catch(() => setNotice("当前使用本地演示数据；连接 D1 后会跨设备保存。"));
    fetch(`/api/reviews?weekKey=${weekKey}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => data.review && setReview({
        progress:data.review.progress ?? "",
        deviation:data.review.deviation ?? "",
        feedback:data.review.feedback ?? "",
        adjustments:data.review.adjustments ?? "",
      }))
      .catch(() => undefined);
    fetch("/api/concepts")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => data.concepts?.length && setConcepts(data.concepts))
      .catch(() => undefined);
  }, [weekKey]);

  const visibleRecords = useMemo(
    () => records.filter((item) => lineFilter === "all" || item.line === lineFilter),
    [records,lineFilter],
  );
  const projects = useMemo(
    () => Array.from(new Set(records.map((item) => item.projectId).filter(Boolean))),
    [records],
  );
  const projectRecords = useMemo(
    () => records.filter((item) => item.projectId === project).sort((a,b) => a.module.localeCompare(b.module,"zh-CN")),
    [records,project],
  );
  const activeMinutes = records.filter((item) => item.status === "active").reduce((sum,item) => sum + item.estimatedMinutes,0);
  const doneCount = records.filter((item) => item.status === "done").length;
  const evidenceCount = records.filter((item) => item.evidence.trim()).length;

  function updateLocal(item:TrellisRecord) {
    setRecords((current) => current.map((record) => record.id === item.id ? item : record));
    setSelected(item);
  }

  async function saveTask(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    updateLocal(selected);
    const response = await fetch(`/api/records/${selected.id}`,{
      method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(selected),
    }).catch(() => null);
    if (response?.ok) {
      const data = await response.json();
      const saved = cleanRecord(data.record);
      updateLocal(saved);
      setNotice("任务、证据和讨论摘要已保存。");
    } else {
      setNotice("已保留在当前页面；连接 D1 后才能跨设备保存。");
    }
  }

  async function setHorizon(item:TrellisRecord,status:Horizon) {
    const updated = {...item,status};
    setRecords((current) => current.map((record) => record.id === item.id ? updated : record));
    const response = await fetch(`/api/records/${item.id}`,{
      method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status}),
    }).catch(() => null);
    setNotice(response?.ok ? `已移到“${horizonMeta[status].label}”。` : "页面已更新，远端保存暂不可用。");
  }

  async function createTask(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const line = String(form.get("line")) as Line;
    const estimatedMinutes = Math.max(15,Number(form.get("minutes")) || 15);
    const payload = {
      title:String(form.get("title") ?? ""),
      recordType:"task",
      line,
      module:String(form.get("module") ?? ""),
      projectId:String(form.get("projectId") ?? ""),
      scheduleRole:"support",
      status:String(form.get("status") ?? "near"),
      estimatedMinutes,
      actualMinutes:0,
      coreAction:String(form.get("why") ?? ""),
      learningScope:"",
      executionMethod:String(form.get("next") ?? ""),
      completionCriteria:String(form.get("evidence") ?? ""),
      evidence:"",
      blockers:"",
      nextStep:String(form.get("next") ?? ""),
      aiReview:"",
      sourceUrl:String(form.get("sourceUrl") ?? "") || null,
      notes:"",
    };
    const response = await fetch("/api/records",{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),
    }).catch(() => null);
    const created = response?.ok
      ? cleanRecord((await response.json()).record)
      : cleanRecord({
          id:crypto.randomUUID(),
          title:payload.title,
          recordType:"task",
          line,
          module:payload.module,
          projectId:payload.projectId,
          scheduleRole:"support",
          status:normalizeHorizon(payload.status),
          estimatedMinutes,
          actualMinutes:0,
          coreAction:payload.coreAction,
          learningScope:"",
          executionMethod:payload.executionMethod,
          completionCriteria:payload.completionCriteria,
          evidence:"",
          blockers:"",
          nextStep:payload.nextStep,
          aiReview:"",
          acceptance:"unreviewed",
          sourceUrl:payload.sourceUrl,
          notes:"",
        });
    setRecords((current) => [created,...current]);
    setNewOpen(false);
    setSelected(created);
    setNotice(response?.ok ? "任务已创建。" : "已创建本地任务；连接 D1 后才能跨设备保存。");
  }

  async function copyContext(item:TrellisRecord) {
    await navigator.clipboard.writeText(contextPacket(item));
    setNotice("任务上下文已复制，可粘贴到 NotebookLM、Gemini、ChatGPT 或 Codex。");
  }

  async function toggleConcept(card:ConceptCard) {
    const updated = {...card,familiar:!card.familiar};
    setConcepts((current) => current.map((item) => item.id === card.id ? updated : item));
    const response = await fetch(`/api/concepts/${card.id}`,{
      method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({familiar:updated.familiar}),
    }).catch(() => null);
    setNotice(response?.ok ? (updated.familiar ? "已标记熟悉；仍可在熟悉卡片中找回。" : "已移回待学习。") : "熟悉度已在页面更新，远端保存暂不可用。");
  }

  async function createConcept(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      title:String(form.get("title") ?? ""),
      module:String(form.get("module") ?? ""),
      officialDefinition:String(form.get("officialDefinition") ?? ""),
      plainExplanation:String(form.get("plainExplanation") ?? ""),
      example:String(form.get("example") ?? ""),
      misconception:String(form.get("misconception") ?? ""),
      sourceUrl:String(form.get("sourceUrl") ?? ""),
    };
    const response = await fetch("/api/concepts",{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),
    }).catch(() => null);
    const concept:ConceptCard = response?.ok
      ? (await response.json()).concept
      : {...payload,id:crypto.randomUUID(),familiar:false};
    setConcepts((current) => [concept,...current]);
    setConceptOpen(false);
    setNotice(response?.ok ? "概念卡已保存。" : "概念卡已加入当前页面，远端保存暂不可用。");
  }

  async function saveReview(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/reviews",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({weekKey,...review}),
    }).catch(() => null);
    setNotice(response?.ok ? "本周复盘已保存。" : "复盘保留在页面，远端保存暂不可用。");
  }

  return <main className="trellis-shell">
    <aside className="trellis-sidebar">
      <div className="trellis-brand"><span>T</span><div><strong>Trellis</strong><small>成长与行动中台</small></div></div>
      <nav aria-label="主导航">{nav.map((item) =>
        <button key={item.key} className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}>
          <span>{item.label}</span><small>{item.hint}</small>
        </button>
      )}</nav>
      <div className="sidebar-note"><strong>V0.1 验证期</strong><p>一周检查重点，两周决定是否扩建。</p></div>
    </aside>

    <section className="trellis-main">
      <header className="trellis-topbar">
        <div><p>{weekKey}</p><h1>{nav.find((item) => item.key === view)?.hint}</h1></div>
        <div className="topbar-actions">{notice && <span>{notice}</span>}<button className="primary" onClick={() => setNewOpen(true)}>＋ 添加任务</button></div>
      </header>

      {view === "week" && <div className="view-stack">
        <section className="focus-banner">
          <div><span>本周重点 · Notebook 测评</span><h2>先跑通一条链路，再讨论更多功能。</h2><p>固定资料 → 设计测试 → 建立指标 → 执行 → 结论 → 作品与复盘</p></div>
          <button onClick={() => {setProject("Notebook 测评");setView("projects");}}>查看完整链路 →</button>
        </section>
        <section className="summary-grid">
          <article><span>进行中预算</span><strong>{stars(activeMinutes)} 星</strong><small>{activeMinutes} 分钟，只是粗估</small></article>
          <article><span>完成任务</span><strong>{doneCount}</strong><small>完成后记录实际用时</small></article>
          <article><span>已有证据</span><strong>{evidenceCount}</strong><small>链接或一句可核验结果</small></article>
          <article><span>计划方式</span><strong>周区间</strong><small>不把任务排死到某一天</small></article>
        </section>
        <div className="line-filter" aria-label="主线筛选">
          <button className={lineFilter === "all" ? "active" : ""} onClick={() => setLineFilter("all")}>全部主线</button>
          {(Object.keys(lineMeta) as Line[]).map((line) =>
            <button key={line} className={lineFilter === line ? "active" : ""} onClick={() => setLineFilter(line)}>{line} · {lineMeta[line].name}</button>
          )}
        </div>
        <section className="horizon-board">
          {boardHorizons.map((horizon) => {
            const items = visibleRecords.filter((item) => item.status === horizon);
            return <div className="board-column" key={horizon}>
              <header><div><strong>{horizonMeta[horizon].label}</strong><small>{horizonMeta[horizon].help}</small></div><span>{items.length}</span></header>
              <div>{items.map((item) => <article className="task-card" key={item.id}>
                <button className="task-card-main" onClick={() => setSelected({...item})}>
                  <span style={{color:lineMeta[item.line].color}}>{item.line} · {lineMeta[item.line].short}</span>
                  <strong>{item.title}</strong>
                  <p>{firstStep(item.executionMethod,item.nextStep)}</p>
                  <footer><span>{item.module.split("·")[0]}</span><b>{stars(item.estimatedMinutes)} ★</b></footer>
                </button>
                <select aria-label={`移动 ${item.title}`} value={item.status} onChange={(event) => setHorizon(item,event.target.value as Horizon)}>
                  {boardHorizons.concat(["done","proposal"]).map((value) => <option key={value} value={value}>{horizonMeta[value].label}</option>)}
                </select>
              </article>)}
              {items.length === 0 && <p className="empty-column">这里暂时没有任务。</p>}
              </div>
            </div>;
          })}
        </section>
      </div>}

      {view === "routes" && <div className="view-stack">
        <section className="route-intro"><p>路线不是待办清单，而是解释前后顺序。任务可以调整，成长方向保持可见。</p></section>
        <div className="line-tabs">{(Object.keys(lineMeta) as Line[]).map((line) =>
          <button key={line} className={routeLine === line ? "active" : ""} onClick={() => setRouteLine(line)}>
            <span>{line}</span><strong>{lineMeta[line].name}</strong><small>{lineMeta[line].purpose}</small>
          </button>
        )}</div>
        <section className="route-list">
          {routeStages[routeLine].map((stage,index) => {
            const tasks = records.filter((item) => item.line === routeLine && item.module.startsWith(stage.id));
            return <article key={stage.id}>
              <div className="route-marker"><span>{stage.order}</span>{index < routeStages[routeLine].length - 1 && <i />}</div>
              <div className="route-content"><header><div><small>{stage.id}</small><h3>{stage.name}</h3><p>{stage.topics}</p></div><b>{tasks.length} 项任务</b></header>
                {tasks.length > 0 && <div className="route-tasks">{tasks.map((item) => <button key={item.id} onClick={() => setSelected({...item})}><span>{horizonMeta[item.status].label}</span>{item.title}<b>{stars(item.estimatedMinutes)} ★</b></button>)}</div>}
              </div>
            </article>;
          })}
        </section>
      </div>}

      {view === "projects" && <div className="project-layout">
        <aside><p>项目</p>{projects.map((name) => <button key={name} className={project === name ? "active" : ""} onClick={() => setProject(name)}>{name}<span>{records.filter((item) => item.projectId === name).length}</span></button>)}</aside>
        <section className="project-detail"><header><span>可交付成果容器</span><h2>{project}</h2><p>{project === "Notebook 测评" ? "验证基于资料的 AI 工作台能否产出有依据、可复现、可继续加工的成果。" : "项目可以跨主线；每一步必须留下能继续使用的结果。"}</p></header>
          <div className="chain">{projectRecords.map((item,index) => <article key={item.id}>
            <div className="chain-index">{item.status === "done" ? "✓" : index + 1}</div>
            <button onClick={() => setSelected({...item})}><span>{item.module}</span><strong>{item.title}</strong><p>{item.completionCriteria}</p><footer><b>{horizonMeta[item.status].label}</b><span>{stars(item.estimatedMinutes)} ★</span>{item.evidence && <em>已有证据</em>}</footer></button>
          </article>)}</div>
        </section>
      </div>}

      {view === "concepts" && <div className="view-stack">
        <section className="concept-head"><div><span>学习主线 · 闪卡</span><h2>先回忆，再核对官方解释。</h2><p>熟悉后可以隐藏概念标签；未来直接导出到 Anki，不在这里重做间隔复习算法。</p></div><button className="primary" onClick={() => setConceptOpen(true)}>＋ 新增概念</button></section>
        <div className="concept-filter"><button className={conceptFilter === "learning" ? "active" : ""} onClick={() => setConceptFilter("learning")}>待学习 {concepts.filter((item) => !item.familiar).length}</button><button className={conceptFilter === "familiar" ? "active" : ""} onClick={() => setConceptFilter("familiar")}>已熟悉 {concepts.filter((item) => item.familiar).length}</button></div>
        <section className="concept-grid">{concepts.filter((item) => conceptFilter === "familiar" ? item.familiar : !item.familiar).map((card) => <article className="concept-card" key={card.id}>
          <header><span>{card.module}</span><button onClick={() => toggleConcept(card)}>{card.familiar ? "移回学习" : "标记熟悉"}</button></header>
          <h3>{card.title}</h3>
          <details><summary>展开核对</summary><div className="concept-body"><section><b>官方解释</b><p>{card.officialDefinition}</p></section><section><b>白话解释</b><p>{card.plainExplanation}</p></section><section><b>例子</b><p>{card.example}</p></section><section><b>常见误区</b><p>{card.misconception}</p></section><a href={card.sourceUrl} target="_blank" rel="noreferrer">查看官方来源 ↗</a></div></details>
        </article>)}</section>
      </div>}

      {view === "tools" && <div className="view-stack">
        <section className="tool-head"><span>工作台地图</span><h2>Trellis 是串联中台，不吞掉专用工具。</h2><p>每个工具只做最擅长的部分；回到 Trellis 的是链接、结论、决定、证据和下一步。</p></section>
        <section className="tool-map">{toolMap.map((tool,index) => <article key={tool.name} className={index === 0 ? "core" : ""}><header><span>{String(index + 1).padStart(2,"0")}</span><h3>{tool.name}</h3></header><p>{tool.role}</p><div><span>回写 Trellis</span><strong>{tool.write}</strong></div><footer>{tool.action}</footer></article>)}</section>
        <section className="tool-flow"><span>外部 Inbox / 资料</span><b>→</b><span>专用 AI 工作台</span><b>→</b><strong>Trellis 决策与行动</strong><b>→</b><span>作品 / 证据 / 复盘</span></section>
      </div>}

      {view === "review" && <div className="review-layout-v1">
        <section><span>Weekly review</span><h2>不是汇报完成率，<br/>而是更新下一轮判断。</h2><p>记录完成第四次发生在第几天、真实投入和有效证据；不追究任务为什么没在某个固定日期完成。</p>
          <div className="review-facts"><div><strong>{doneCount}</strong><span>完成</span></div><div><strong>{records.reduce((sum,item) => sum + item.actualMinutes,0)}</strong><span>实际分钟</span></div><div><strong>{evidenceCount}</strong><span>证据</span></div></div>
        </section>
        <form onSubmit={saveReview}>
          <label>本周最大进展<textarea value={review.progress} onChange={(e) => setReview({...review,progress:e.target.value})}/></label>
          <label>主要偏差与原因<textarea value={review.deviation} onChange={(e) => setReview({...review,deviation:e.target.value})} placeholder="哪些事情比预计慢？真正原因是什么？"/></label>
          <label>哪些安排有效 / 无效<textarea value={review.feedback} onChange={(e) => setReview({...review,feedback:e.target.value})} placeholder="星级、任务大小、资料入口是否帮助启动？"/></label>
          <label>下一周调整<textarea value={review.adjustments} onChange={(e) => setReview({...review,adjustments:e.target.value})}/></label>
          <button className="primary" type="submit">保存本周判断</button>
        </form>
      </div>}
    </section>

    {newOpen && <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setNewOpen(false)}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="new-title">
        <header><div><span>动态添加</span><h2 id="new-title">新增一个能开始的任务</h2></div><button onClick={() => setNewOpen(false)} aria-label="关闭">×</button></header>
        <form onSubmit={createTask}>
          <label>任务名称<input required name="title" autoFocus placeholder="例如：整理 Notebook 的三份核心资料"/></label>
          <div className="form-row"><label>主线<select name="line">{(Object.keys(lineMeta) as Line[]).map((line) => <option key={line} value={line}>{line} · {lineMeta[line].name}</option>)}</select></label><label>状态<select name="status" defaultValue="near">{boardHorizons.concat(["proposal"]).map((value) => <option key={value} value={value}>{horizonMeta[value].label}</option>)}</select></label><label>时间预算<select name="minutes" defaultValue="30">{[15,30,45,60,75,90,120].map((minutes) => <option key={minutes} value={minutes}>{stars(minutes)} ★ · {minutes} 分钟</option>)}</select></label></div>
          <div className="form-row two"><label>路线阶段<input required name="module" placeholder="例如：G5 · LLM 应用工程"/></label><label>关联项目<input required name="projectId" placeholder="例如：Notebook 测评"/></label></div>
          <label>为什么现在做<textarea required name="why" placeholder="它解决什么问题，为什么排在这里？"/></label>
          <label>第一步是什么<textarea required name="next" placeholder="写一个打开页面后马上能做的动作"/></label>
          <label>完成后留下什么<textarea required name="evidence" placeholder="链接、文档、截图、代码或一句可核验结果"/></label>
          <label>核心资料链接（选填）<input name="sourceUrl" type="url" placeholder="https://..."/></label>
          <footer><button type="button" onClick={() => setNewOpen(false)}>取消</button><button className="primary" type="submit">创建任务</button></footer>
        </form>
      </section>
    </div>}

    {conceptOpen && <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setConceptOpen(false)}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="concept-title">
        <header><div><span>Concept flashcard</span><h2 id="concept-title">新增概念卡</h2></div><button onClick={() => setConceptOpen(false)} aria-label="关闭">×</button></header>
        <form onSubmit={createConcept}>
          <div className="form-row two"><label>概念名称<input required name="title" autoFocus placeholder="例如：Embedding / 向量嵌入"/></label><label>学习阶段<input required name="module" defaultValue="G5 · LLM 应用工程"/></label></div>
          <label>官方解释<textarea required name="officialDefinition" placeholder="优先依据官方文档、论文或教材"/></label>
          <label>白话解释<textarea required name="plainExplanation" placeholder="用自己的话讲清楚"/></label>
          <div className="form-row two"><label>例子<textarea required name="example"/></label><label>常见误区<textarea required name="misconception"/></label></div>
          <label>官方来源链接<input required name="sourceUrl" type="url" placeholder="https://..."/></label>
          <footer><button type="button" onClick={() => setConceptOpen(false)}>取消</button><button className="primary" type="submit">保存概念卡</button></footer>
        </form>
      </section>
    </div>}

    {selected && <div className="overlay drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}>
      <aside className="task-drawer-v1" role="dialog" aria-modal="true" aria-labelledby="task-title">
        <header><div><span style={{color:lineMeta[selected.line].color}}>{selected.line} · {lineMeta[selected.line].name} / {selected.projectId}</span><h2 id="task-title">{selected.title}</h2></div><button onClick={() => setSelected(null)} aria-label="关闭">×</button></header>
        <form onSubmit={saveTask}>
          <section className="next-panel"><span>现在只做这一步</span><h3>{firstStep(selected.executionMethod,selected.nextStep)}</h3><div><b>{stars(selected.estimatedMinutes)} ★ · 约 {selected.estimatedMinutes} 分钟</b>{selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer">打开核心资料 ↗</a>}</div></section>
          <div className="drawer-grid three">
            <label>状态<select value={selected.status} onChange={(e) => setSelected({...selected,status:e.target.value as Horizon})}>{Object.keys(horizonMeta).map((value) => <option key={value} value={value}>{horizonMeta[value as Horizon].label}</option>)}</select></label>
            <label>预计分钟<input type="number" min="15" step="15" value={selected.estimatedMinutes} onChange={(e) => setSelected({...selected,estimatedMinutes:Number(e.target.value)})}/></label>
            <label>实际分钟<input type="number" min="0" step="5" value={selected.actualMinutes} onChange={(e) => setSelected({...selected,actualMinutes:Number(e.target.value)})}/></label>
          </div>
          <label>路线阶段与顺序<input value={selected.module} onChange={(e) => setSelected({...selected,module:e.target.value})}/></label>
          <label>为什么这样安排<textarea value={selected.coreAction} onChange={(e) => setSelected({...selected,coreAction:e.target.value})}/></label>
          <label>任务边界<textarea value={selected.learningScope} onChange={(e) => setSelected({...selected,learningScope:e.target.value})}/></label>
          <label>执行步骤<textarea value={selected.executionMethod} onChange={(e) => setSelected({...selected,executionMethod:e.target.value})}/></label>
          <label>前置条件 / 卡住时怎么办<textarea value={selected.blockers} onChange={(e) => setSelected({...selected,blockers:e.target.value})}/></label>
          <label>完成标准<textarea value={selected.completionCriteria} onChange={(e) => setSelected({...selected,completionCriteria:e.target.value})}/></label>
          <div className="drawer-grid two"><label>核心资料链接<input type="url" value={selected.sourceUrl ?? ""} onChange={(e) => setSelected({...selected,sourceUrl:e.target.value || null})}/></label><label>证据链接或结果<input value={selected.evidence} onChange={(e) => setSelected({...selected,evidence:e.target.value})} placeholder="完成后回写"/></label></div>
          <section className="ai-panel"><header><div><span>与 AI 讨论</span><p>复制包含路线、原因、前置、下一步和资料的最小上下文。</p></div><button type="button" onClick={() => copyContext(selected)}>复制上下文</button></header>
            <textarea value={selected.aiReview} onChange={(e) => setSelected({...selected,aiReview:e.target.value})} placeholder="把外部讨论的结论、分歧和下一步粘贴到这里；路线修改必须先标为待确认提案。"/>
          </section>
          <footer className="drawer-save"><span>保存会同时记录实际用时、证据和讨论摘要。</span><button className="primary" type="submit">保存任务</button></footer>
        </form>
      </aside>
    </div>}
  </main>;
}
