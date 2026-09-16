"use client";

import { useEffect, useState } from "react";
import type { LearningProgram, publicProgramUnit, assessProgramCheck } from "../../../lib/learning/intelligence/learning-program";
import "./program.css";

type Unit = NonNullable<ReturnType<typeof publicProgramUnit>>;
type Result = ReturnType<typeof assessProgramCheck>;
async function request(body: unknown) {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const response = await fetch("/api/internal/course-intelligence/program", { method: "POST", headers: { "content-type": "application/json", ...(local ? { "x-trellis-admin": "true" } : {}) }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "内容审阅失败");
  return data;
}

export default function LearningProgramPreview() {
  const [weeks, setWeeks] = useState<8 | 12>(8);
  const [minutes, setMinutes] = useState(240);
  const [direction, setDirection] = useState("ai_literacy");
  const [plan, setPlan] = useState<LearningProgram | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<"diagnostic" | "review">("diagnostic");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [practice, setPractice] = useState("");
  const [help, setHelp] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { queueMicrotask(() => setReady(true)); }, []);
  const unit = units.find(item => item.id === selected);
  async function generate() {
    setBusy(true); setError("");
    try {
      const data = await request({ action: "plan", request: { direction, weeks, weeklyMinutes: minutes } });
      setPlan(data.plan); setUnits(data.units); setSelected(null); setResult(null);
    } catch (error) { setError(error instanceof Error ? error.message : "生成失败"); }
    finally { setBusy(false); }
  }
  function openUnit(id: string, nextPhase: "diagnostic" | "review" = "diagnostic") {
    setSelected(id); setPhase(nextPhase); setAnswers({}); setPractice(""); setHelp(false); setResult(null); setError("");
  }
  async function submit() {
    setBusy(true); setError("");
    try { setResult((await request({ action: "check", unitId: selected, phase, answers, usedHelp: help })).result); }
    catch (error) { setError(error instanceof Error ? error.message : "评价失败"); }
    finally { setBusy(false); }
  }
  return <main className="program-preview">
    <a href="/internal/course-intelligence">返回内容审阅</a>
    <h1>AI学习路线与活动审阅</h1>
    <p className="preview-boundary">内容原型：使用原创教学与规则评价，尚未经过专家和真人验收。此处不修改正式路线，答案仅保留在当前页面；不是已交付的学习保存功能。</p>
    {!unit && <section aria-label="规划条件" className="program-form">
      <label>方向<select value={direction} onChange={event => setDirection(event.target.value)}><option value="ai_literacy">AI通识与使用判断</option><option value="ai_product">AI产品应用与评价</option></select></label>
      <label>周期<select value={weeks} onChange={event => setWeeks(Number(event.target.value) as 8 | 12)}><option value={8}>8周</option><option value={12}>12周</option></select></label>
      <label>每周投入（分钟）<input type="number" min={15} max={2400} step={15} value={minutes} onChange={event => setMinutes(Number(event.target.value))} /></label>
      <button disabled={busy || !ready} onClick={generate}>{!ready ? "正在准备…" : busy ? "正在处理…" : "查看周期安排"}</button>
    </section>}
    {error && <p role="alert">{error}</p>}
    {plan && !unit && <>
      <h2>{plan.status === "ready" ? "可进入内容审阅" : "当前时间安排存在冲突"}</h2>
      <p>活动设计投入 {plan.requiredMinutes} 分钟；周期可用 {plan.availableMinutes} 分钟。尚未证明教学效果。</p>
      {plan.issues.length > 0 && <ul>{plan.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
      <details><summary>规划假设与限制</summary><ul>{plan.assumptions.map(item => <li key={item}>{item}</li>)}</ul></details>
      <div className="program-weeks">{plan.weeks.map(week => <section key={week.week}>
        <h3>第{week.week}周</h3><p>{week.plannedMinutes} / {week.capacityMinutes} 分钟</p>
        {week.activities.length === 0 ? <p>本周未安排活动，保留为缓冲；不是新增学习成果。</p> : <ul>{week.activities.map(activity => <li key={activity.id}><button onClick={() => openUnit(activity.unitId, activity.kind === "review" ? "review" : "diagnostic")}>{activity.title}</button><span>{activity.minutes} 分钟</span></li>)}</ul>}
      </section>)}</div>
    </>}
    {unit && <article>
      <button onClick={() => setSelected(null)}>返回周期安排（当前输入不保存）</button>
      <h2>{unit.title}</h2>
      <ul>{unit.objectives.map(objective => <li key={objective}>{objective}</li>)}</ul>
      <h3>讲解</h3>{unit.lesson.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
      <h3>示例</h3><p>{unit.example}</p>
      <details><summary>补充课程与访问说明</summary><p><a href={unit.source.url} target="_blank" rel="noreferrer">{unit.source.title}</a>：{unit.source.section}</p><p>{unit.source.access}</p></details>
      <h3>应用练习</h3><p>{unit.practice}</p><ul>{unit.rubric.map(item => <li key={item}>{item}</li>)}</ul>
      <label>练习草稿（原型不保存或自动评审）<textarea value={practice} onChange={event => setPractice(event.target.value)} rows={5} /></label>
      <h3>{phase === "review" ? "新情景复查" : "独立检查"}</h3>
      {unit.checks[phase].map(question => <fieldset key={question.id}><legend>{question.prompt}</legend>{question.options.map(option => <label key={option.id}><input type="radio" name={question.id} checked={answers[question.id] === option.id} onChange={() => { setAnswers(previous => ({ ...previous, [question.id]: option.id })); setResult(null); }} />{option.text}</label>)}</fieldset>)}
      <label><input type="checkbox" checked={help} onChange={event => { setHelp(event.target.checked); setResult(null); }} />这次作答使用了讲解或其他帮助</label>
      <button disabled={busy} onClick={submit}>{busy ? "正在检查…" : "查看本次检查反馈"}</button>
      {result && <section aria-live="polite"><h3>{result.status === "needs_revision" ? "需要针对性回看" : result.status === "practice_complete" ? "练习完成，尚非独立验证" : "本次检查通过"}</h3>
        {result.criteria.map(item => <div key={item.questionId}><h4>{item.objective}：{item.passed ? "符合本题要求" : "需要修改"}</h4><p>你的选择：{item.selectedAnswer}</p><p>{item.explanation}</p><p>{item.nextAction}</p></div>)}
        <p>{result.limitation}</p><button onClick={() => { setPhase(phase === "diagnostic" ? "review" : "diagnostic"); setAnswers({}); setHelp(false); setResult(null); }}>切换另一组情景检查</button>
      </section>}
    </article>}
  </main>;
}
