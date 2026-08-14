"use client";

import { useMemo, useState } from "react";

const STAGES = [
  {
    id: "map",
    title: "1. 生成可信学习地图",
    label: "路径先行",
    summary: "用户只输入目标和时间，Trellis 先建立主干、分支、前置关系和推荐理由。",
    detail:
      "第一眼不是课程列表，而是一张可选择的学习树：当前路线、相邻分支、条件前置和材料缺口都在同一张图里。",
  },
  {
    id: "week",
    title: "2. 编排本周活动",
    label: "马上能学",
    summary: "长期路径不会每天乱变，但会被拆成一周内可完成的核心和可选活动。",
    detail:
      "活动以 30 分钟 + n × 15 分钟组织，包含目标表现、输入材料、学习行为、工具和证据要求。",
  },
  {
    id: "evidence",
    title: "3. 用证据更新成长",
    label: "不是打卡",
    summary: "点击完成不等于掌握；答案、作品、代码、判断和解释才是节点变色的依据。",
    detail:
      "证据不足会退回修订；证据被接受后，节点才可能从成长中进入已验证，并记录支持证据。",
  },
  {
    id: "adjust",
    title: "4. 稳定但会调整",
    label: "动态编排",
    summary: "活动可以动态调整，周计划保持半稳定，长期路径版本化且需要用户确认。",
    detail:
      "Trellis 会解释为什么建议补前置、增加练习、切换支架或进入下一个节点，避免路线随意漂移。",
  },
] as const;

const ROUTE_NODES = [
  { name: "AI 机制与边界", status: "validated", branch: "AI 通识与认知" },
  { name: "问题适配与人机职责", status: "growing", branch: "AI 通识与认知" },
  { name: "上下文与可核验使用", status: "growing", branch: "AI 通识与认知" },
  { name: "应用架构选择", status: "unstarted", branch: "AI 应用开发" },
  { name: "评测与人工确认", status: "unstarted", branch: "AI 产品经理" },
] as const;

const STATUS_TEXT = {
  validated: "已验证",
  growing: "成长中",
  unstarted: "未点亮",
} as const;

export default function ProductStory() {
  const [activeStage, setActiveStage] = useState<(typeof STAGES)[number]["id"]>("map");
  const [weeklyHours, setWeeklyHours] = useState(3);
  const [mode, setMode] = useState<"breadth" | "build" | "product">("breadth");
  const [evidenceAccepted, setEvidenceAccepted] = useState(false);

  const selectedStage = STAGES.find((stage) => stage.id === activeStage) ?? STAGES[0];
  const activities = useMemo(() => {
    const baseCount = weeklyHours <= 2 ? 2 : weeklyHours <= 4 ? 3 : 4;
    const focus =
      mode === "build"
        ? "先用一个小型 AI 应用产出验证理解"
        : mode === "product"
          ? "先形成产品判断与评估能力"
          : "先建立 AI 通识主干和判断框架";
    return {
      baseCount,
      optionalCount: weeklyHours >= 4 ? 2 : 1,
      focus,
      minutes: weeklyHours * 60,
    };
  }, [mode, weeklyHours]);

  return (
    <div className="tp-story">
      <section className="tp-panel tp-interactive">
        <div>
          <p className="tp-eyebrow">互动演示</p>
          <h2>试一下 Trellis 如何把模糊目标变成一周计划</h2>
          <p>
            这里不是正式诊断，只是演示产品逻辑：目标方向和每周时间会影响首周活动数量、主线重点和证据要求。
          </p>
        </div>
        <div className="tp-controls">
          <label>
            每周时间
            <input
              type="range"
              min="2"
              max="6"
              step="1"
              value={weeklyHours}
              onChange={(event) => setWeeklyHours(Number(event.target.value))}
            />
            <b>{weeklyHours} 小时</b>
          </label>
          <label>
            目标倾向
            <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
              <option value="breadth">先建立全局认知</option>
              <option value="build">尽快做出 AI 应用</option>
              <option value="product">偏 AI 产品经理能力</option>
            </select>
          </label>
        </div>
        <div className="tp-plan-card">
          <span>首周编排结果</span>
          <h3>{activities.focus}</h3>
          <p>
            本周容量 {activities.minutes} 分钟，建议 {activities.baseCount} 个核心活动，
            {activities.optionalCount} 个可选活动。系统推荐顺序，但用户只需在一周内按需推进。
          </p>
        </div>
      </section>

      <section className="tp-grid">
        <div className="tp-panel">
          <p className="tp-eyebrow">核心闭环</p>
          <h2>四步看懂 Trellis</h2>
          <div className="tp-stage-list">
            {STAGES.map((stage) => (
              <button
                key={stage.id}
                className={activeStage === stage.id ? "active" : ""}
                onClick={() => setActiveStage(stage.id)}
              >
                <span>{stage.label}</span>
                {stage.title}
              </button>
            ))}
          </div>
        </div>
        <div className="tp-panel tp-stage-detail">
          <span>{selectedStage.label}</span>
          <h2>{selectedStage.title}</h2>
          <p>{selectedStage.summary}</p>
          <small>{selectedStage.detail}</small>
        </div>
      </section>

      <section className="tp-grid tp-map-area">
        <div className="tp-panel">
          <p className="tp-eyebrow">成长地图</p>
          <h2>同一张图，同时表示路径和进展</h2>
          <div className="tp-map">
            {ROUTE_NODES.map((node, index) => {
              const status = node.name === "上下文与可核验使用" && evidenceAccepted ? "validated" : node.status;
              return (
                <div key={node.name} className={`tp-node ${status}`}>
                  <i>{index + 1}</i>
                  <b>{node.name}</b>
                  <span>{node.branch}</span>
                  <em>{STATUS_TEXT[status]}</em>
                </div>
              );
            })}
          </div>
        </div>
        <div className="tp-panel">
          <p className="tp-eyebrow">证据驱动</p>
          <h2>节点不会因为“点完成”变色</h2>
          <p>
            模拟提交一份证据。接受后，对应节点会从成长中变为已验证；这才是 Trellis 的可信感来源。
          </p>
          <button className="tp-primary" onClick={() => setEvidenceAccepted((value) => !value)}>
            {evidenceAccepted ? "撤回演示证据" : "提交并接受证据"}
          </button>
          <div className={evidenceAccepted ? "tp-evidence accepted" : "tp-evidence"}>
            <b>{evidenceAccepted ? "证据已接受" : "等待证据"}</b>
            <span>
              {evidenceAccepted
                ? "节点「上下文与可核验使用」已进入已验证，并保留支持证据。"
                : "当前节点仍是成长中；只有被接受的解释、作品、代码或判断才会更新状态。"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

