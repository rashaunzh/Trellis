"use client";

// 工作台：收集箱、系统推荐资源、工具卡片 —— 资源/工具与学习节点的映射
import { useEffect, useState } from "react";
import Shell from "../_components/shell";
import {
  fetchWorkspace,
  fetchInboxResources,
  addInboxResource,
  fetchApiConfig,
  saveApiConfig,
  type ApiConfigStatus,
  type Workspace,
  type WorkspaceUserResource,
} from "../../lib/learning/frontend";

type InboxItem = {
  id: string;
  type: "link" | "note" | "tool" | "resource";
  title: string;
  content: string;
  mappedNodeId: string;
};

// 资源按学习路线分组
const ROUTE_GROUPS = [
  { prefix: "ai-literacy.", label: "AI 通识与认知" },
  { prefix: "ai-app-dev.", label: "AI 应用开发" },
  { prefix: "ai-product.", label: "AI 产品经理" },
] as const;

// 节点中文标题来自 workspace 聚合（内容包为唯一真相）
function nodeTitleOf(ws: Workspace | null, nodeId: string): string {
  return ws?.nodeProgress.find((p) => p.nodeId === nodeId)?.title ?? nodeId;
}

export default function WorkbenchPage() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [inboxResources, setInboxResources] = useState<WorkspaceUserResource[]>([]);
  const [inboxType, setInboxType] = useState<InboxItem["type"]>("link");
  const [inboxText, setInboxText] = useState("");
  const [workbenchMessage, setWorkbenchMessage] = useState("");
  // AI 配置
  const [apiStatus, setApiStatus] = useState<ApiConfigStatus>({
    configured: false,
    enabled: false,
    baseUrl: "",
    model: "",
    keyMasked: false,
  });
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiModel, setApiModel] = useState("");
  const [apiEnabled, setApiEnabled] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchWorkspace()
      .then((next) => { if (alive) setWs(next); })
      .catch(() => { if (alive) setWs(null); });
    fetchInboxResources()
      .then((resources) => { if (alive) setInboxResources(resources); })
      .catch(() => { /* 收集箱加载失败不阻塞页面 */ });
    return () => { alive = false; };
  }, []);

  // 加载 API 配置状态（独立于 workspace，未诊断用户也能配）
  useEffect(() => {
    let alive = true;
    fetchApiConfig()
      .then((status) => {
        if (!alive) return;
        setApiStatus(status);
        setApiBaseUrl(status.baseUrl);
        setApiModel(status.model);
        setApiEnabled(status.enabled);
      })
      .catch(() => { /* 配置读取失败不阻塞页面 */ });
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
    // 未诊断：仍展示 AI 接入配置（不依赖学习状态）
    return (
      <Shell>
        <div className="t2-topbar">
          <div>
            <p className="t2-kicker">工作台 · 资源与工具</p>
            <h1>还没有学习地图</h1>
          </div>
        </div>
        <div className="t2-center t2-onboard-note">
          <p>先在「学习」页完成诊断，工作台会展示与你路线匹配的资源与工具。</p>
          <a className="t2-primary t2-link" href="/learn">去学习页开始</a>
        </div>
        <AiConfigSection
          apiStatus={apiStatus}
          apiBaseUrl={apiBaseUrl}
          apiKey={apiKey}
          apiModel={apiModel}
          apiEnabled={apiEnabled}
          aiBusy={aiBusy}
          setApiBaseUrl={setApiBaseUrl}
          setApiKey={setApiKey}
          setApiModel={setApiModel}
          setApiEnabled={setApiEnabled}
          onSaved={(next) => { setApiStatus(next); setApiKey(""); setWorkbenchMessage("API 配置已保存。密钥只存服务端，不回显。"); }}
          onError={() => setWorkbenchMessage("保存失败：请检查接口地址与 Key。")}
          setAiBusy={setAiBusy}
        />
      </Shell>
    );
  }

  const resources = ws.workbench.resources;
  const tools = ws.workbench.tools;

  async function addInboxItem(input: { type: InboxItem["type"]; title: string; content: string }) {
    const { resources } = await addInboxResource({
      type: input.type,
      title: input.title,
      content: input.content,
    });
    setInboxResources(resources);
  }

  return (
    <Shell>
      <div className="t2-topbar">
        <div>
          <p className="t2-kicker">工作台 · 资源与工具</p>
          <h1>不是收藏夹，是映射到节点的可用材料</h1>
        </div>
      </div>

      {workbenchMessage && <p className="t2-message">{workbenchMessage}</p>}

      {/* 收集箱 */}
      <div className="t2-inbox-panel">
        <div>
          <b>收集箱</b>
          <p>
            用户材料、链接与想法先进入这里做映射检查，不直接改变正式地图。
            目的不是收藏，而是降低你回到飞书/网页/工具里找材料的频率。
          </p>
        </div>
        <div className="t2-inbox-form">
          <select value={inboxType} onChange={(e) => setInboxType(e.target.value as InboxItem["type"])}>
            <option value="link">链接/课程</option>
            <option value="note">想法/笔记</option>
            <option value="tool">工具</option>
            <option value="resource">材料</option>
          </select>
          <textarea
            value={inboxText}
            onChange={(e) => setInboxText(e.target.value)}
            placeholder="粘贴链接，或写下你刚收集到的材料/想法。"
          />
          <button
            className="t2-primary"
            disabled={!inboxText.trim()}
            onClick={() => {
              void addInboxItem({
                type: inboxType,
                title: inboxText.trim().split("\n")[0].slice(0, 48),
                content: inboxText.trim(),
              })
                .then(() => {
                  setInboxText("");
                  setWorkbenchMessage("已加入收集箱（持久化保存，刷新不丢）。");
                })
                .catch((e) => setWorkbenchMessage(e instanceof Error ? e.message : "加入失败"));
            }}
          >
            加入收集箱
          </button>
        </div>
        <div className="t2-inbox-list">
          {inboxResources.map((item) => (
            <article key={item.id} className="t2-inbox-item">
              <span>{item.type}</span>
              <b>{item.title}</b>
              <p>{item.content}</p>
              {item.sourceUrl && (
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceUrl.slice(0, 60)}</a>
              )}
            </article>
          ))}
          {inboxResources.length === 0 && <p className="t2-empty">还没有临时材料。先丢一个链接或想法进来试试。</p>}
        </div>
      </div>

      <AiConfigSection
        apiStatus={apiStatus}
        apiBaseUrl={apiBaseUrl}
        apiKey={apiKey}
        apiModel={apiModel}
        apiEnabled={apiEnabled}
        aiBusy={aiBusy}
        setApiBaseUrl={setApiBaseUrl}
        setApiKey={setApiKey}
        setApiModel={setApiModel}
        setApiEnabled={setApiEnabled}
        onSaved={(next) => { setApiStatus(next); setApiKey(""); setWorkbenchMessage("API 配置已保存。密钥只存服务端，不回显。"); }}
        onError={() => setWorkbenchMessage("保存失败：请检查接口地址与 Key。")}
        setAiBusy={setAiBusy}
      />

      {/* 资源列表：按路线分组看板 */}
      <section className="t2-section">
        <header>
          <h3>系统推荐资源</h3>
          <span className="t2-muted">按学习路线分组；资源都映射到具体节点与学习用途。</span>
        </header>
        <div className="t2-route-board">
          {ROUTE_GROUPS.map((group) => {
            const groupResources = resources.filter((r) => r.nodeId.startsWith(group.prefix));
            if (groupResources.length === 0) return null;
            return (
              <div key={group.prefix} className="t2-route-column">
                <header>
                  <b>{group.label}</b>
                  <small>{groupResources.length} 个资源</small>
                </header>
                <div className="t2-route-resources">
                  {groupResources.map((r) => (
                    <article key={r.resourceId} className="t2-resource-card">
                      <div className="t2-resource-main">
                        <div className="t2-resource-head">
                          <span>{r.sourceType} · 可信度 {r.credibilityLevel}/5</span>
                          <em>节点：{nodeTitleOf(ws, r.nodeId)}</em>
                        </div>
                        <h4>{r.title}</h4>
                        <p>{r.summary}</p>
                        <small>用途：{r.usage}</small>
                      </div>
                      <div className="t2-resource-actions">
                        <button
                          className="t2-mini"
                          onClick={() => {
                            addInboxItem({
                              type: "resource",
                              title: r.title,
                              content: `${r.summary}\n用途：${r.usage}`,
                              mappedNodeId: r.nodeId,
                            });
                            setWorkbenchMessage("资源已加入收集箱。");
                          }}
                        >
                          加入收集箱
                        </button>
                        {r.url && <a href={r.url} target="_blank" rel="noreferrer">打开 ↗</a>}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
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
                <span>对应节点：{nodeTitleOf(ws, t.nodeId)}</span>
              </header>
              <p>{t.description}</p>
              <div className="t2-tool-usage">
                <span>适合在</span>
                <strong>{t.activityContext}</strong>
              </div>
              <footer>
                <em>{t.usage}</em>
                <div className="t2-tool-actions">
                  <button
                    className="t2-mini"
                    onClick={() => {
                      addInboxItem({
                        type: "tool",
                        title: t.name,
                        content: `${t.description}\n适合在：${t.activityContext}`,
                        mappedNodeId: t.nodeId,
                      });
                      setWorkbenchMessage("工具已加入收集箱。");
                    }}
                  >
                    本周使用
                  </button>
                  {t.url && <a href={t.url} target="_blank" rel="noreferrer">打开 ↗</a>}
                </div>
              </footer>
            </article>
          ))}
          {tools.length === 0 && <p className="t2-empty">暂无工具推荐。</p>}
        </div>
      </section>
    </Shell>
  );
}

// ── AI 接入配置 ────────────────────────────────────
// 用户自配 OpenAI 兼容 API（base_url / key / model / 启用开关），
// key 只存服务端表，前端不回显。保存成功后回调 onSaved。
function AiConfigSection({
  apiStatus,
  apiBaseUrl,
  apiKey,
  apiModel,
  apiEnabled,
  aiBusy,
  setApiBaseUrl,
  setApiKey,
  setApiModel,
  setApiEnabled,
  onSaved,
  onError,
  setAiBusy,
}: {
  apiStatus: ApiConfigStatus;
  apiBaseUrl: string;
  apiKey: string;
  apiModel: string;
  apiEnabled: boolean;
  aiBusy: boolean;
  setApiBaseUrl: (v: string) => void;
  setApiKey: (v: string) => void;
  setApiModel: (v: string) => void;
  setApiEnabled: (v: boolean) => void;
  onSaved: (next: ApiConfigStatus) => void;
  onError: () => void;
  setAiBusy: (v: boolean) => void;
}) {
  return (
    <section className="t2-section">
      <header>
        <h3>AI 接入</h3>
        <span className="t2-muted">配置你自己的模型 API（OpenAI 兼容协议），Evidence Evaluator 用它评估证据；未配置时回退规则版。</span>
      </header>
      <div className="t2-ai-panel">
        <div>
          <b>{apiStatus.configured ? "已配置" : "未配置"} · {apiStatus.enabled ? "已启用" : "未启用"}</b>
          <p>
            {apiStatus.configured
              ? `接口：${apiStatus.baseUrl || "—"} · 模型：${apiStatus.model || "—"} · API Key 已保存（不回显）`
              : "填入 OpenAI 兼容接口地址与 Key（如 DeepSeek / 公司中转站），保存后评估走模型。"}
          </p>
        </div>
      </div>
      <div className="t2-ai-form">
        <label>
          接口地址（base_url）
          <input
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="https://api.deepseek.com/v1"
          />
        </label>
        <label>
          API Key
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={apiStatus.configured ? "已保存，留空保持不变" : "sk-..."}
          />
        </label>
        <label>
          模型
          <input
            value={apiModel}
            onChange={(e) => setApiModel(e.target.value)}
            placeholder="deepseek-chat"
          />
        </label>
        <label className="t2-ai-toggle">
          <input
            type="checkbox"
            checked={apiEnabled}
            onChange={(e) => setApiEnabled(e.target.checked)}
          />
          启用 LLM 评估
        </label>
        <button
          className="t2-primary"
          disabled={aiBusy || !apiBaseUrl.trim()}
          onClick={() => void (async () => {
            setAiBusy(true);
            try {
              const next = await saveApiConfig({
                baseUrl: apiBaseUrl,
                apiKey: apiKey || undefined,
                model: apiModel,
                enabled: apiEnabled,
              });
              onSaved(next);
            } catch {
              onError();
            } finally {
              setAiBusy(false);
            }
          })()}
        >
          保存配置
        </button>
      </div>
    </section>
  );
}
