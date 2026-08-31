"use client";

import { useCallback, useEffect, useState } from "react";

import "./review.css";

type Candidate = {
  id: string;
  title: string;
  sourceUrl: string;
  outline: string[];
  analysisJson: string;
  status: "candidate" | "validated" | "rejected" | "published";
  updatedAt: string;
};

function adminHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers["content-type"] = "application/json";
  if (typeof location !== "undefined" && ["localhost", "127.0.0.1"].includes(location.hostname)) {
    headers["x-trellis-admin"] = "true";
  }
  return headers;
}

export default function CourseIntelligenceReviewPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [reason, setReason] = useState("");
  const [publishJson, setPublishJson] = useState("");
  const [message, setMessage] = useState("正在读取候选内容...");

  const load = useCallback(async () => {
    const response = await fetch("/api/internal/course-intelligence/candidates", {
      headers: adminHeaders(),
      cache: "no-store",
    });
    const body = await response.json() as { candidates?: Candidate[]; error?: string };
    if (!response.ok) {
      setMessage(body.error ?? "无法读取候选内容");
      return;
    }
    setCandidates(body.candidates ?? []);
    setSelected((current) => current
      ? body.candidates?.find((item) => item.id === current.id) ?? null
      : body.candidates?.[0] ?? null);
    setMessage((body.candidates?.length ?? 0) > 0 ? "" : "目前没有待评审课程。");
  }, []);

  useEffect(() => {
    // Initial network synchronization; state updates occur after fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function review(decision: "validated" | "rejected") {
    if (!selected || reason.trim().length < 3) {
      setMessage("请先填写至少 3 个字的评审理由。");
      return;
    }
    const response = await fetch(
      `/api/internal/course-intelligence/candidates/${encodeURIComponent(selected.id)}/review`,
      {
        method: "POST",
        headers: adminHeaders(true),
        body: JSON.stringify({ decision, reason }),
      },
    );
    const body = await response.json() as { error?: string };
    setMessage(response.ok ? "评审结果已保存。" : body.error ?? "保存失败");
    if (response.ok) {
      setReason("");
      await load();
    }
  }

  return (
    <main className="review-page">
      <header className="review-header">
        <div>
          <p>内部内容治理</p>
          <h1>课程候选评审</h1>
        </div>
        <span>{candidates.length} 个候选</span>
      </header>
      {message ? <p className="review-message" role="status">{message}</p> : null}
      <div className="review-layout">
        <nav className="candidate-list" aria-label="课程候选">
          {candidates.map((candidate) => (
            <button
              className={selected?.id === candidate.id ? "is-selected" : ""}
              key={candidate.id}
              onClick={() => {
                setSelected(candidate);
                setPublishJson("");
              }}
              type="button"
            >
              <strong>{candidate.title}</strong>
              <span>{candidate.status} · {candidate.outline.length} 节</span>
            </button>
          ))}
        </nav>
        {selected ? (
          <section className="candidate-detail">
            <div className="candidate-title">
              <div>
                <span>{selected.status}</span>
                <h2>{selected.title}</h2>
              </div>
              {selected.sourceUrl ? <a href={selected.sourceUrl} rel="noreferrer" target="_blank">查看来源</a> : null}
            </div>
            <h3>解析目录</h3>
            <ol>{selected.outline.map((item) => <li key={item}>{item}</li>)}</ol>
            <details>
              <summary>查看模型分析原文</summary>
              <pre>{formatAnalysis(selected.analysisJson)}</pre>
            </details>
            <label htmlFor="review-reason">评审理由</label>
            <textarea
              id="review-reason"
              onChange={(event) => setReason(event.target.value)}
              placeholder="说明来源、章节映射或质量判断依据"
              value={reason}
            />
            <div className="review-actions">
              <button className="secondary" onClick={() => void review("rejected")} type="button">退回</button>
              <button onClick={() => void review("validated")} type="button">验证候选</button>
            </div>
            {selected.status === "validated" ? (
              <details className="publish-panel">
                <summary>发布已验证课程</summary>
                <label htmlFor="published-course-json">PublishedCourse JSON</label>
                <textarea
                  id="published-course-json"
                  onChange={(event) => setPublishJson(event.target.value)}
                  placeholder="粘贴包含 genome、tags、mappings 的完整发布对象"
                  value={publishJson}
                />
                <button onClick={() => void publishCandidate()} type="button">执行发布检查</button>
              </details>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );

  async function publishCandidate() {
    if (!selected) return;
    let payload: unknown;
    try {
      payload = JSON.parse(publishJson);
    } catch {
      setMessage("PublishedCourse JSON 格式无效。");
      return;
    }
    const response = await fetch(
      `/api/internal/course-intelligence/candidates/${encodeURIComponent(selected.id)}/publish`,
      {
        method: "POST",
        headers: adminHeaders(true),
        body: JSON.stringify(payload),
      },
    );
    const body = await response.json() as { error?: string };
    setMessage(response.ok ? "课程版本已发布。" : body.error ?? "发布失败");
    if (response.ok) await load();
  }
}

function formatAnalysis(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
