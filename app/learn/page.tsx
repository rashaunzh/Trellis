"use client";

import { useEffect, useMemo, useState } from "react";
import "./learn.css";

type 能力 = { id:string; 名称:string; 说明:string; 前置:string[]; 毕业等级:number; 关键毕业项:boolean; 核心问题:string; 学习结果:string; 关键概念:string[]; 情境练习:{题目:string;提示:string;参考要点:string[]}; 来源:string[] };
type 内容包 = { 名称:string;版本:string;建议分钟下限:number;建议分钟上限:number;能力:能力[];诊断题:Array<{id:string;能力Id:string;题目:string;选项:Array<{值:string;文本:string}>}>;综合任务:{名称:string;说明:string};熟练等级:string[];学习状态:string[];来源:string[] };
type 路径项 = { id:string;capabilityId:string;title:string;sequence:number;targetLevel:number;estimatedMinutes:number;rationale:string };
type 学习状态 = { diagnostic:null|{goal:string;weeklyMinutes:number;materials:string[];answers:Record<string,string>;selfReport:Record<string,string>;scores:Record<string,number>;status:string}; proposal:null|{id:string;status:"pending"|"confirmed"|"rejected";explanation:string}; items:路径项[] };
type 进度 = { activeCapabilityId:string;completedActivities:string[];evidence:Record<string,string>;reviewAnswers:Record<string,string> };
type 视图 = "today"|"path"|"review"|"resources"|"session";

const 空状态:学习状态 = {diagnostic:null,proposal:null,items:[]};
const 空进度:进度 = {activeCapabilityId:"mechanism",completedActivities:[],evidence:{},reviewAnswers:{}};

async function 读取Json(response:Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "请求失败");
  return data;
}

export default function LearnPage() {
  const [content,setContent] = useState<内容包|null>(null);
  const [state,setState] = useState<学习状态>(空状态);
  const [progress,setProgress] = useState<进度>(空进度);
  const [goal,setGoal] = useState("");
  const [weeklyMinutes,setWeeklyMinutes] = useState(180);
  const [materialsText,setMaterialsText] = useState("");
  const [answers,setAnswers] = useState<Record<string,string>>({});
  const [selfReport,setSelfReport] = useState<Record<string,string>>({experience:"new",style:"example"});
  const [started,setStarted] = useState(false);
  const [view,setView] = useState<视图>("today");
  const [busy,setBusy] = useState(true);
  const [message,setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/learning/content").then(读取Json),
      fetch("/api/learning/diagnostic").then(读取Json),
      fetch("/api/learning/progress").then(读取Json).catch(() => ({progress:null})),
    ]).then(([contentData,stateData,progressData]) => {
      setContent(contentData.contentPack);
      setState(stateData);
      if (stateData.diagnostic) {
        setGoal(stateData.diagnostic.goal ?? "");
        setWeeklyMinutes(stateData.diagnostic.weeklyMinutes ?? 180);
        setMaterialsText((stateData.diagnostic.materials ?? []).join("\n"));
        setAnswers(stateData.diagnostic.answers ?? {});
        setSelfReport({...selfReport,...(stateData.diagnostic.selfReport ?? {})});
        setStarted(!stateData.proposal);
      }
      if (progressData.progress) setProgress(progressData.progress);
    }).catch((error) => setMessage(error instanceof Error ? error.message : "暂时无法读取学习状态"))
      .finally(() => setBusy(false));
  // 首次装载后由用户操作更新状态。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const payload = useMemo(() => ({goal,weeklyMinutes,answers,selfReport,materials:materialsText.split(/\r?\n/).map((item)=>item.trim()).filter(Boolean)}),[goal,weeklyMinutes,answers,selfReport,materialsText]);
  const confirmed = state.proposal?.status === "confirmed";
  const totalMinutes = state.items.reduce((sum,item)=>sum+item.estimatedMinutes,0);
  const currentCapability = content?.能力.find((item)=>item.id===progress.activeCapabilityId) ?? content?.能力[0];
  const completedCount = progress.completedActivities.length;

  async function saveDiagnostic(method:"PUT"|"POST") {
    setBusy(true); setMessage("");
    try {
      const data = await fetch("/api/learning/diagnostic",{method,headers:{"content-type":"application/json"},body:JSON.stringify(payload)}).then(读取Json);
      setState(data); setStarted(method === "PUT");
      if (method === "PUT") setMessage("草稿已保存，刷新后可以继续。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败"); }
    finally { setBusy(false); }
  }

  async function decide(status:"confirmed"|"rejected") {
    if (!state.proposal) return;
    setBusy(true); setMessage("");
    try {
      const data = await fetch("/api/learning/proposal",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:state.proposal.id,status})}).then(读取Json);
      setState({...state,proposal:data.proposal}); setView("today");
    } catch (error) { setMessage(error instanceof Error ? error.message : "更新失败"); }
    finally { setBusy(false); }
  }

  async function saveProgress(next:进度, successMessage?:string) {
    if (!state.proposal) return;
    setBusy(true); setMessage("");
    try {
      const data = await fetch("/api/learning/progress",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({...next,proposalId:state.proposal.id})}).then(读取Json);
      setProgress(data.progress); if (successMessage) setMessage(successMessage);
    } catch (error) { setMessage(error instanceof Error ? error.message : "进度保存失败"); }
    finally { setBusy(false); }
  }

  function complete(activityId:string) {
    if (progress.completedActivities.includes(activityId)) return;
    void saveProgress({...progress,completedActivities:[...progress.completedActivities,activityId]},"已保存为学习证据，不会自动提升正式熟练等级。");
  }

  if (busy && !content) return <main className="learn-loading"><b>Trellis</b><p>正在准备你的学习环境……</p></main>;
  if (!content) return <main className="learn-loading"><b>Trellis</b><p>{message || "内容包不可用"}</p></main>;

  if (!started && !state.proposal) return <main className="learn-onboarding">
    <header><b>Trellis</b><span>AI 通识 · 自适应学习 MVP</span></header>
    <section><p className="kicker">不是课程目录，而是一条由证据驱动的学习路径</p><h1>知道你要去哪里，<br/>也知道你该从哪里开始。</h1><p className="lead">Trellis 先理解你的目标和现有证据，再安排学习、练习与复习。年龄和职业不会把你塞进伪分类，自报也不会替代真实表现。</p><div className="onboarding-flow"><article><b>01</b><span>短诊断</span><p>目标、材料与情境判断</p></article><article><b>02</b><span>个性路径</span><p>解释补什么、压缩什么</p></article><article><b>03</b><span>边学边校准</span><p>用练习和证据更新路径</p></article></div><button onClick={()=>setStarted(true)}>开始建立我的路径</button><small>约 20 分钟 · 可中途保存 · 不需要模型密钥</small></section>
  </main>;

  if (started && !state.proposal) return <main className="diagnostic-page">
    <header><button className="wordmark" onClick={()=>setStarted(false)}>Trellis</button><span>初始诊断</span><b>{Object.keys(answers).filter((key)=>key.startsWith("q-")).length} / {content.诊断题.length}</b></header>
    <div className="diagnostic-grid"><aside><p className="kicker">先建立工作假设</p><h1>告诉我目标，<br/>表现题交给你。</h1><p>自报只改变解释方式和活动支架。只有答题、作品或后续任务能形成掌握证据。</p><div className="privacy-note">材料只保存你填写的名称或链接。不要粘贴公司机密、密钥和个人敏感信息。</div></aside>
      <section className="diagnostic-form">
        <div className="form-card"><span>01 · 学习诉求</span><label>你希望学会后能完成什么？<textarea value={goal} onChange={(e)=>setGoal(e.target.value)} placeholder="例如：能评审一个 AI 功能方案，而不是只会使用聊天工具" /></label><div className="form-row"><label>每周容量<select value={weeklyMinutes} onChange={(e)=>setWeeklyMinutes(Number(e.target.value))}><option value="120">2 小时</option><option value="180">3 小时</option><option value="240">4 小时</option><option value="300">5 小时</option><option value="360">6 小时</option></select></label><label>目前经验<select value={selfReport.experience} onChange={(e)=>setSelfReport({...selfReport,experience:e.target.value})}><option value="new">刚开始系统了解</option><option value="user">经常使用 AI 工具</option><option value="builder">参与过 AI 功能设计</option></select></label></div></div>
        <div className="form-card"><span>02 · 已有材料</span><label>课程、文档、作品或链接（可选，每行一项）<textarea value={materialsText} onChange={(e)=>setMaterialsText(e.target.value)} placeholder="这里只做覆盖检查，不会因为‘看过’就跳过能力" /></label></div>
        <div className="form-card"><span>03 · 六项能力快检</span>{content.诊断题.map((question,index)=><fieldset key={question.id}><legend><b>{index+1}</b>{question.题目}</legend>{question.选项.map((option)=><label className="choice" key={option.值}><input type="radio" name={question.id} checked={answers[question.id]===option.值} onChange={()=>setAnswers({...answers,[question.id]:option.值})}/><span>{option.文本}</span></label>)}</fieldset>)}</div>
        <div className="form-card"><span>04 · 短情境题</span><label>一个团队想把 AI 直接用于高影响决策。你会先追问什么？<textarea value={answers["scenario-fit"]??""} onChange={(e)=>setAnswers({...answers,"scenario-fit":e.target.value})} placeholder="写 2–4 个你认为必须回答的问题" /></label><label>你会如何证明这个功能可以上线？<textarea value={answers["scenario-eval"]??""} onChange={(e)=>setAnswers({...answers,"scenario-eval":e.target.value})} placeholder="说明测试、失败检查或人工确认" /></label><p>开放回答本版仅作为支架依据，不由 AI 自动改变正式路径。</p></div>
        {message && <p className="learn-message">{message}</p>}<footer><button className="secondary" disabled={busy} onClick={()=>saveDiagnostic("PUT")}>保存草稿</button><button disabled={busy} onClick={()=>saveDiagnostic("POST")}>查看路径提案</button></footer>
      </section></div>
  </main>;

  if (!confirmed) return <main className="proposal-page"><header><b>Trellis</b><span>路径提案 · {state.proposal?.status==="rejected"?"已退回":"待你确认"}</span></header><section className="proposal-hero"><div><p className="kicker">诊断不是给你贴标签</p><h1>这是一条可修改、<br/>有依据的学习提案。</h1><p>{state.proposal?.explanation}</p></div><div className="total-card"><strong>{Math.round(totalMinutes/30)/2}</strong><span>预计小时</span><small>按每周 {Math.round(weeklyMinutes/60*10)/10} 小时，约 {Math.ceil(totalMinutes/weeklyMinutes)} 周</small></div></section><section className="score-strip">{content.能力.map((cap)=><div key={cap.id}><span>{cap.名称}</span><b>{state.diagnostic?.scores?.[cap.id] ?? 0}</b><small>当前证据 / {cap.毕业等级}</small></div>)}</section><section className="proposal-list">{state.items.map((item)=><article key={item.id}><b>{String(item.sequence).padStart(2,"0")}</b><div><span>{item.estimatedMinutes/15*0.5} 星 · 目标等级 {item.targetLevel}</span><h2>{item.title}</h2><p>{item.rationale}</p></div></article>)}</section>{message&&<p className="learn-message">{message}</p>}<footer className="proposal-actions">{state.proposal?.status==="rejected"?<button onClick={()=>{setState({...state,proposal:null,items:[]});setStarted(true);}}>修改诊断并重新生成</button>:<><button className="secondary" disabled={busy} onClick={()=>decide("rejected")}>退回修改诊断</button><button disabled={busy} onClick={()=>decide("confirmed")}>确认并开始第一周</button></>}</footer></main>;

  return <main className="workspace-shell">
    <aside className="learn-sidebar"><div className="brand"><i>T</i><div><b>Trellis</b><span>AI 通识路径</span></div></div><nav>{[["today","继续学习"],["path","学习路径"],["review","复习与评估"],["resources","资源库"]].map(([id,label])=><button key={id} className={view===id?"active":""} onClick={()=>setView(id as 视图)}>{label}</button>)}</nav><div className="sidebar-progress"><span>路径进度</span><b>{completedCount} 项证据</b><div><i style={{width:`${Math.min(100,completedCount/18*100)}%`}}/></div><small>熟练等级与学习状态分开记录</small></div></aside>
    <section className="learn-workspace"><header className="workspace-top"><div><span>AI 通识 V1.1</span><b>{state.diagnostic?.goal}</b></div><button onClick={()=>setView("resources")}>查看依据</button></header>
      {message&&<p className="learn-message">{message}</p>}
      {view==="today"&&<TodayView capability={currentCapability!} weeklyMinutes={weeklyMinutes} completed={progress.completedActivities} onOpen={()=>setView("session")} onPath={()=>setView("path")}/>}
      {view==="path"&&<PathView content={content} items={state.items} scores={state.diagnostic?.scores??{}} activeId={progress.activeCapabilityId} completed={progress.completedActivities} onSelect={(id)=>{void saveProgress({...progress,activeCapabilityId:id});setView("session");}}/>}
      {view==="session"&&<SessionView capability={currentCapability!} progress={progress} busy={busy} onComplete={complete} onEvidence={(value)=>saveProgress({...progress,evidence:{...progress.evidence,[currentCapability!.id]:value}},"练习回答已保存为待确认的证据。") } onBack={()=>setView("today")}/>}
      {view==="review"&&<ReviewView content={content} completed={progress.completedActivities} onPath={()=>setView("path")}/>}
      {view==="resources"&&<ResourcesView content={content}/>}
    </section>
  </main>;
}

function TodayView({capability,weeklyMinutes,completed,onOpen,onPath}:{capability:能力;weeklyMinutes:number;completed:string[];onOpen:()=>void;onPath:()=>void}) {
  const done = ["understand","practice","evidence"].filter((step)=>completed.includes(`${capability.id}-${step}`)).length;
  return <div className="today-view"><section className="today-hero"><div><p className="kicker">本周焦点 · 能力 1</p><h1>{capability.名称}</h1><p>{capability.学习结果}</p><button onClick={onOpen}>{done ? "继续本次学习" : "开始第一次学习"}</button></div><div className="week-capacity"><span>本周容量</span><b>{weeklyMinutes/60} 小时</b><small>不绑定具体日期</small></div></section><section className="dashboard-grid"><article className="next-card"><span>下一步 · 约 25 分钟</span><h2>{capability.核心问题}</h2><p>先建立必要直觉，再用一个真实情境暴露判断过程。</p><div className="step-dots"><i className={done>0?"done":""}/><i className={done>1?"done":""}/><i className={done>2?"done":""}/></div></article><article><span>为什么从这里开始</span><h2>它是后续判断的共同前置</h2><p>没有机制边界，提示、架构和评测很容易变成只记术语。</p><button className="text-button" onClick={onPath}>查看完整路径 →</button></article></section><section className="week-plan"><header><div><span>本周编排</span><h2>核心活动少而完整</h2></div><b>{done}/3 已完成</b></header>{[{id:"understand",title:"建立机制直觉",time:"20 分钟"},{id:"practice",title:"完成情境判断",time:"20 分钟"},{id:"evidence",title:"整理一条可复核证据",time:"15 分钟"}].map((item)=><div key={item.id} className={completed.includes(`${capability.id}-${item.id}`)?"complete":""}><i>{completed.includes(`${capability.id}-${item.id}`)?"✓":""}</i><b>{item.title}</b><span>{item.time}</span></div>)}</section></div>;
}

function PathView({content,items,scores,activeId,completed,onSelect}:{content:内容包;items:路径项[];scores:Record<string,number>;activeId:string;completed:string[];onSelect:(id:string)=>void}) {
  return <div className="workspace-page"><p className="kicker">能力地图</p><h1>不是章节顺序，是掌握前置。</h1><p className="page-intro">已有证据会压缩活动，不会降低毕业门槛。关键能力必须在综合任务和延迟复测中再次验证。</p><div className="capability-map">{items.map((item)=>{const cap=content.能力.find((entry)=>entry.id===item.capabilityId)!;const done=completed.filter((id)=>id.startsWith(`${cap.id}-`)).length;const unlocked=cap.前置.every((id)=>completed.includes(`${id}-evidence`));return <article key={item.id} className={cap.id===activeId?"active":""}><div className="cap-number">{item.sequence}</div><div><span>{cap.关键毕业项?"关键毕业项":"核心能力"} · 当前证据 {scores[cap.id]??0}/{item.targetLevel}</span><h2>{cap.名称}</h2><p>{cap.说明}</p><small>前置：{cap.前置.length?cap.前置.map((id)=>content.能力.find((x)=>x.id===id)?.名称).join("、"):"无"}</small></div><button disabled={!unlocked} onClick={()=>onSelect(cap.id)}>{unlocked?(done?"继续":"进入"):"待完成前置"}</button></article>})}</div></div>;
}

function SessionView({capability,progress,busy,onComplete,onEvidence,onBack}:{capability:能力;progress:进度;busy:boolean;onComplete:(id:string)=>void;onEvidence:(value:string)=>Promise<void>;onBack:()=>void}) {
  const [draft,setDraft]=useState(progress.evidence[capability.id]??"");
  return <div className="session-page"><button className="back-button" onClick={onBack}>← 返回本周</button><p className="kicker">结构化学习会话 · {capability.名称}</p><h1>{capability.核心问题}</h1><section className="lesson-block"><span>先建立解释</span><h2>四个必要直觉</h2><div className="concept-grid">{capability.关键概念.map((item,index)=><article key={item}><b>{index+1}</b><p>{item}</p></article>)}</div><button disabled={busy||progress.completedActivities.includes(`${capability.id}-understand`)} onClick={()=>onComplete(`${capability.id}-understand`)}>{progress.completedActivities.includes(`${capability.id}-understand`)?"已完成理解":"我能用自己的话解释"}</button></section><section className="lesson-block practice-block"><span>再暴露判断过程</span><h2>{capability.情境练习.题目}</h2><p>{capability.情境练习.提示}</p><textarea value={draft} onChange={(e)=>setDraft(e.target.value)} placeholder="写下你的判断、理由和需要核验的证据……"/><div className="practice-actions"><button className="secondary" disabled={!draft.trim()||busy} onClick={()=>void onEvidence(draft)}>保存回答</button><button disabled={!draft.trim()||busy} onClick={()=>onComplete(`${capability.id}-practice`)}>完成情境练习</button></div>{progress.evidence[capability.id]&&<details><summary>对照参考要点</summary><ul>{capability.情境练习.参考要点.map((item)=><li key={item}>{item}</li>)}</ul><p>参考要点用于自检，不自动把回答判为正式掌握。</p></details>}</section><section className="lesson-block evidence-block"><span>形成证据</span><h2>把“我看过”变成“我能做到”</h2><p>当回答已经包含判断、依据和边界时，将它标记为一条待复核证据。正式熟练等级仍需综合任务或延迟复测确认。</p><button disabled={!progress.evidence[capability.id]||busy||progress.completedActivities.includes(`${capability.id}-evidence`)} onClick={()=>onComplete(`${capability.id}-evidence`)}>{progress.completedActivities.includes(`${capability.id}-evidence`)?"证据已记录":"记录为待复核证据"}</button></section></div>;
}

function ReviewView({content,completed,onPath}:{content:内容包;completed:string[];onPath:()=>void}) {
  const evidenceCount=completed.filter((id)=>id.endsWith("-evidence")).length;
  return <div className="workspace-page"><p className="kicker">复习与评估</p><h1>评分必须指向证据。</h1><p className="page-intro">单次答对最多形成初步掌握；综合任务与延迟复测才用于验证迁移。</p><div className="review-grid"><article><span>待复核证据</span><b>{evidenceCount}</b><p>来自学习会话中的情境回答</p></article><article><span>延迟复测</span><b>未到期</b><p>首项证据形成后安排，不绑定固定日期</p></article></div><section className="capstone-card"><span>毕业综合任务</span><h2>{content.综合任务.名称}</h2><p>{content.综合任务.说明}</p><div className="rubric-list"><b>问题适配、评测设计、风险控制：目标 3</b><b>机制选择、工作流、方案表达：至少 2</b><b>隐私、安全或高风险自动化红线：一票否决</b></div><button className="secondary" onClick={onPath}>先完成核心能力路径</button></section></div>;
}

function ResourcesView({content}:{content:内容包}) {
  return <div className="workspace-page"><p className="kicker">版本化内容包 · {content.版本}</p><h1>知道每个判断从哪里来。</h1><p className="page-intro">正式内容优先使用标准、能力框架和官方文档。社区内容只用于发现问题，不自动进入内容包。</p><div className="resource-list">{content.能力.map((cap)=><article key={cap.id}><div><span>{cap.名称}</span><h2>{cap.学习结果}</h2></div><div>{cap.来源.map((url)=><a href={url} target="_blank" rel="noreferrer" key={url}>打开一手来源 ↗</a>)}</div></article>)}</div></div>;
}
