"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { fetchActivityLesson, getOwnerId, recordLearningSignal } from "../../../../lib/learning/frontend";
import "../../../internal/learning-program/program.css";

type Lesson = Awaited<ReturnType<typeof fetchActivityLesson>>;
type Draft = { phase: "diagnostic" | "review"; answers: Record<string, string>; usedHelp: boolean; note: string; version: string; expectedSignalId: string | null; submissionId: string };
const blank = (lesson: Lesson, phase: Draft["phase"] = "diagnostic"): Draft => ({ phase, answers: {}, usedHelp: false, note: "", version: lesson.version, expectedSignalId: lesson.expectedSignalId, submissionId: crypto.randomUUID() });

export default function ActivityLesson({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const key = () => `trellis.lesson.${getOwnerId()}.${id}`;
  useEffect(() => {
    let alive = true;
    fetchActivityLesson(id).then(data => {
      if (!alive) return;
      setLesson(data);
      let restored: Draft | null = null;
      try {
        const saved = JSON.parse(localStorage.getItem(`trellis.lesson.${getOwnerId()}.${id}`) ?? "null");
        if (saved && ["diagnostic", "review"].includes(saved.phase) && typeof saved.note === "string" && typeof saved.usedHelp === "boolean" && typeof saved.version === "string" && typeof saved.submissionId === "string" && saved.answers && Object.values(saved.answers).every(value => typeof value === "string") && (saved.expectedSignalId === null || typeof saved.expectedSignalId === "string")) restored = saved;
      } catch { /* 无草稿时从服务端历史继续 */ }
      setDraft(restored ?? blank(data));
      if (restored) setMessage("已恢复这台设备上的未提交内容。提交后答案与反馈会保存到账号。若其他页面已有新结果，请保留草稿并查看最新记录。");
    }).catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : "教学内容加载失败"); });
    return () => { alive = false; };
  }, [id]);

  function update(next: Draft) {
    setDraft(next);
    try { localStorage.setItem(key(), JSON.stringify(next)); }
    catch { setMessage("设备草稿保存失败，请保持页面打开并提交；尚未保存到账号。"); }
  }
  async function submit() {
    if (!draft || !lesson || busy) return;
    setBusy(true); setError("");
    try {
      await recordLearningSignal(id, { type: "program_check", value: draft.phase, note: draft.note,
        questionId: draft.version, submissionId: draft.submissionId, expectedSignalId: draft.expectedSignalId,
        context: { answers: draft.answers, usedHelp: draft.usedHelp } });
      // 获取结果失败时保留原草稿与提交标识；再次提交恢复同一条记录。
      const next = await fetchActivityLesson(id);
      setLesson(next); update(blank(next, draft.phase));
      setMessage("答案和逐题反馈已保存。练习笔记已一并保存，尚未进行开放成果评价。");
      document.getElementById("saved-feedback")?.focus();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "提交失败，草稿已保留，可以重试"); }
    finally { setBusy(false); }
  }

  async function refreshBaseline() {
    if (!draft || busy) return;
    setBusy(true); setError("");
    try {
      const next = await fetchActivityLesson(id);
      setLesson(next);
      update({ ...draft, version: next.version, expectedSignalId: next.expectedSignalId, submissionId: crypto.randomUUID(), answers: draft.version === next.version ? draft.answers : {} });
      setMessage("已读取最新记录并保留笔记。请对照下方最新反馈再提交；若内容版本变化，选择题需重新作答。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "刷新失败，输入已保留"); }
    finally { setBusy(false); }
  }

  return <main className="program-preview">
    <Link href="/learn">← 返回当前学习</Link>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!lesson || !draft ? <p>{error ? "可以返回当前学习后重试。" : "正在恢复教学与提交记录…"}</p> : <>
      <p>当前任务：{lesson.activityTitle}</p>
      <h1>{lesson.unit.title}</h1>
      <p>这份补充教学帮助你理解当前主题。检查按预设答案逐题反馈；不代替课程完整考核或开放成果评审。</p>
      <h2>本次学习目标</h2><ul>{lesson.unit.objectives.map(item => <li key={item}>{item}</li>)}</ul>
      <h2>讲解与示例</h2>{lesson.unit.lesson.map(item => <p key={item}>{item}</p>)}
      <blockquote>{lesson.unit.example}</blockquote>
      <details><summary>参考来源与访问条件</summary><a href={lesson.unit.source.url} target="_blank" rel="noreferrer">{lesson.unit.source.title}</a><p>{lesson.unit.source.section}</p><p>{lesson.unit.source.access}</p></details>
      <h2>动手练习</h2><p>{lesson.unit.practice}</p>
      <label>练习笔记（随检查保存，尚未评审）<textarea rows={5} maxLength={1200} value={draft.note} disabled={busy} onChange={event => update({ ...draft, note: event.target.value, submissionId: crypto.randomUUID() })} /></label>
      <p>自查要求：{lesson.unit.rubric.join("；")}。</p>
      <h2>{draft.phase === "diagnostic" ? "检查你的理解" : "用另一组情景复测"}</h2>
      <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        {lesson.unit.checks[draft.phase].map(question => <fieldset key={question.id} disabled={busy}><legend>{question.prompt}</legend>{question.options.map(option => <label key={option.id}><input type="radio" required name={question.id} value={option.id} checked={draft.answers[question.id] === option.id} onChange={() => update({ ...draft, answers: { ...draft.answers, [question.id]: option.id }, submissionId: crypto.randomUUID() })} />{option.text}</label>)}</fieldset>)}
        <label><input type="checkbox" checked={draft.usedHelp} disabled={busy} onChange={event => update({ ...draft, usedHelp: event.target.checked, submissionId: crypto.randomUUID() })} />作答时使用了讲解、答案或他人帮助</label>
        <p>输入草稿保存在这台设备。提交后答案、笔记与反馈保存到账号；当前检查不自动完成原任务。</p>
        <button disabled={busy || draft.version !== lesson.version} type="submit">{busy ? "正在保存并评价…" : "保存答案并查看反馈"}</button>
      </form>
      {draft.version !== lesson.version && <p role="alert">内容已有新版本。旧草稿保留在上方，请复制需要的内容后开始新版检查。</p>}
      {(error || draft.version !== lesson.version || draft.expectedSignalId !== lesson.expectedSignalId) && <button disabled={busy} onClick={refreshBaseline}>保留笔记并读取最新记录</button>}
      <section id="saved-feedback" tabIndex={-1} aria-label="已保存的反馈">
        <h2>已保存的反馈</h2>
        {!lesson.submissions.length ? <p>提交后会在这里显示逐题依据和下一步。</p> : <>
          <button disabled={busy} onClick={() => { update(blank(lesson, "review")); setMessage("已开始另一组检查。初次答案与笔记保留在下面的历史记录。"); }}>开始另一组检查</button>
          {lesson.submissions.map((item, index) => <details key={item.id} open={index === 0}><summary>{index === 0 ? "最近一次" : "历史"} · {new Date(item.createdAt).toLocaleString("zh-CN")} · {item.evaluation.status === "needs_revision" ? "需要针对性回看" : item.evaluation.status === "practice_complete" ? "带帮助练习完成" : "本次检查通过"}</summary>
            <p>{item.evaluation.limitation}</p>{item.note && <blockquote>本次练习笔记：{item.note}</blockquote>}
            {item.evaluation.criteria.map(row => <div key={row.questionId}><h3>{row.objective} · {row.passed ? "本题通过" : "需修改"}</h3><p>你选择：{row.selectedAnswer}</p><p>{row.explanation}</p><p>下一步：{row.nextAction}</p></div>)}
          </details>)}
        </>}
      </section>
    </>}
  </main>;
}
