"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "./learn.css";

type 内容包 = {
  名称:string; 版本:string; 建议分钟下限:number; 建议分钟上限:number;
  能力:Array<{id:string;名称:string;说明:string;毕业等级:number}>;
  诊断题:Array<{id:string;能力Id:string;题目:string;选项:Array<{值:string;文本:string}>}>;
};
type 路径项 = {id:string;capabilityId:string;title:string;sequence:number;targetLevel:number;estimatedMinutes:number;rationale:string};
type 状态 = {
  diagnostic:null | {goal:string;weeklyMinutes:number;materials:string[];answers:Record<string,string>;status:string};
  proposal:null | {id:string;status:"pending"|"confirmed"|"rejected";explanation:string};
  items:路径项[];
};

const 空状态:状态 = { diagnostic:null, proposal:null, items:[] };

export default function LearnPage() {
  const [content,setContent] = useState<内容包|null>(null);
  const [state,setState] = useState<状态>(空状态);
  const [goal,setGoal] = useState("");
  const [weeklyMinutes,setWeeklyMinutes] = useState(180);
  const [materialsText,setMaterialsText] = useState("");
  const [answers,setAnswers] = useState<Record<string,string>>({});
  const [started,setStarted] = useState(false);
  const [busy,setBusy] = useState(true);
  const [message,setMessage] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/learning/content").then((r) => r.json()),fetch("/api/learning/diagnostic").then((r) => r.json())])
      .then(([contentData,stateData]) => {
        setContent(contentData.contentPack);
        if (stateData.diagnostic) {
          setState(stateData);
          setGoal(stateData.diagnostic.goal ?? "");
          setWeeklyMinutes(stateData.diagnostic.weeklyMinutes ?? 180);
          setMaterialsText((stateData.diagnostic.materials ?? []).join("\n"));
          setAnswers(stateData.diagnostic.answers ?? {});
          setStarted(!stateData.proposal);
        }
      }).catch(() => setMessage("暂时无法读取学习状态，请稍后刷新。"))
      .finally(() => setBusy(false));
  },[]);

  const payload = useMemo(() => ({
    goal, weeklyMinutes, answers, selfReport:{},
    materials:materialsText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
  }),[goal,weeklyMinutes,answers,materialsText]);

  async function saveDraft() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/learning/diagnostic",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
    const data = await response.json();
    if (response.ok) { setState(data); setMessage("草稿已保存。刷新页面后可以继续。"); }
    else setMessage(data.error ?? "保存失败");
    setBusy(false);
  }

  async function submitDiagnostic() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/learning/diagnostic",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
    const data = await response.json();
    if (response.ok) { setState(data); setStarted(false); }
    else setMessage(data.error ?? "提交失败");
    setBusy(false);
  }

  async function decide(status:"confirmed"|"rejected") {
    if (!state.proposal) return;
    setBusy(true); setMessage("");
    const response = await fetch("/api/learning/proposal",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:state.proposal.id,status})});
    const data = await response.json();
    if (response.ok) setState({...state,proposal:data.proposal});
    else setMessage(data.error ?? "更新失败");
    setBusy(false);
  }

  if (busy && !content) return <main className="learn-shell"><p>正在读取 AI 通识内容包……</p></main>;
  if (!content) return <main className="learn-shell"><p>{message || "内容包不可用"}</p></main>;

  const confirmed = state.proposal?.status === "confirmed";
  const pending = state.proposal?.status === "pending";
  const rejected = state.proposal?.status === "rejected";
  const totalMinutes = state.items.reduce((sum,item) => sum + item.estimatedMinutes,0);

  return <main className="learn-shell">
    <header className="learn-header"><Link href="/">Trellis</Link><span>AI 通识 V1 · {content.版本}</span></header>

    {!started && !state.proposal && <section className="learn-hero">
      <span>第一条自适应学习路径</span>
      <h1>先看真实表现，<br/>再决定从哪里开始。</h1>
      <p>用 20–30 分钟完成学习诉求与六道情境判断。系统按能力前置关系生成路径提案；自报不会直接替代掌握证据。</p>
      <div className="learn-facts"><b>6 项核心能力</b><b>12–18 小时</b><b>无需模型密钥</b></div>
      <button onClick={() => setStarted(true)}>开始初始诊断</button>
    </section>}

    {started && !state.proposal && <section className="diagnostic-layout">
      <aside><span>初始诊断</span><h1>目标、容量与表现证据</h1><p>你的回答用于生成路径，不会自动判定正式掌握。</p></aside>
      <div className="diagnostic-form">
        <label>你想通过 AI 通识解决什么问题？<textarea value={goal} onChange={(e)=>setGoal(e.target.value)} placeholder="例如：能够判断和设计一个基础 AI 功能方案" /></label>
        <label>每周可投入时间<select value={weeklyMinutes} onChange={(e)=>setWeeklyMinutes(Number(e.target.value))}><option value="120">2 小时</option><option value="180">3 小时</option><option value="240">4 小时</option><option value="300">5 小时</option><option value="360">6 小时</option></select></label>
        <label>已有材料（可选，每行一项）<textarea value={materialsText} onChange={(e)=>setMaterialsText(e.target.value)} placeholder="课程、文档、作品或链接；后续只用于覆盖检查" /></label>
        {content.诊断题.map((question,index) => <fieldset key={question.id}><legend><b>{index+1}</b>{question.题目}</legend>{question.选项.map((option)=><label className="choice" key={option.值}><input type="radio" name={question.id} checked={answers[question.id]===option.值} onChange={()=>setAnswers({...answers,[question.id]:option.值})}/><span>{option.文本}</span></label>)}</fieldset>)}
        {message && <p className="learn-message">{message}</p>}
        <footer><button className="secondary" disabled={busy} onClick={saveDraft}>保存草稿</button><button disabled={busy} onClick={submitDiagnostic}>生成路径提案</button></footer>
      </div>
    </section>}

    {(pending || confirmed || rejected) && <section className="path-view">
      <header><div><span>{confirmed ? "已确认路径" : rejected ? "已拒绝提案" : "待确认路径提案"}</span><h1>{confirmed ? "从能力证据开始学习" : "先审阅依据，再决定是否采用"}</h1><p>{state.proposal?.explanation}</p></div><div className="path-total"><strong>{Math.round(totalMinutes/30)/2}</strong><span>预计小时</span></div></header>
      <div className="path-list">{state.items.map((item)=><article key={item.id}><div className="path-index">{item.sequence}</div><div><span>目标等级 {item.targetLevel} · {item.estimatedMinutes/15*0.5} 星</span><h2>{item.title}</h2><p>{item.rationale}</p></div></article>)}</div>
      {message && <p className="learn-message">{message}</p>}
      {pending && <footer><button className="secondary" disabled={busy} onClick={()=>decide("rejected")}>拒绝并保留记录</button><button disabled={busy} onClick={()=>decide("confirmed")}>确认这条路径</button></footer>}
      {rejected && <footer><button onClick={()=>{setStarted(true);setState({...state,proposal:null,items:[]});}}>修改诊断并重新提案</button></footer>}
      {confirmed && <div className="confirmed-note"><b>路径已成为正式学习入口</b><p>下一切片将从第一项能力进入结构化学习会话；当前不会改写 V0.1 看板。</p></div>}
    </section>}
  </main>;
}
