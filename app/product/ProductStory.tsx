import { useEffect, useMemo, useState } from "react";
import { STAGES, ROUTE_NODES, STATUS_TEXT } from "./ProductStory.data";

// 产品宣传页：纯展示，无交互控件。
// 演示数据固定（每周 4 小时、先建立全局认知），核心闭环自动轮播，
// 证据驱动演示自动播放——给用户看和宣传，不做真实诊断。

const DEMO_WEEKLY_HOURS = 4;

export default function ProductStory() {
  const [activeStage, setActiveStage] = useState<(typeof STAGES)[number]["id"]>("map");
  const [evidenceAccepted, setEvidenceAccepted] = useState(false);

  // 自动轮播核心闭环（展示用，不可点击）
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStage((current) => {
        const index = STAGES.findIndex((stage) => stage.id === current);
        return STAGES[(index + 1) % STAGES.length].id;
      });
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  // 自动演示证据驱动：进入页面 2s 后接受，6s 后撤回，循环
  useEffect(() => {
    const acceptTimer = setTimeout(() => setEvidenceAccepted(true), 2000);
    const revokeTimer = setTimeout(() => setEvidenceAccepted(false), 6500);
    return () => {
      clearTimeout(acceptTimer);
      clearTimeout(revokeTimer);
    };
  }, [evidenceAccepted]);

  const selectedStage = STAGES.find((stage) => stage.id === activeStage) ?? STAGES[0];

  const activities = useMemo(() => {
    const baseCount = DEMO_WEEKLY_HOURS <= 2 ? 2 : DEMO_WEEKLY_HOURS <= 4 ? 3 : 4;
    const focus = "先建立 AI 通识主干和判断框架";
    return {
      baseCount,
      optionalCount: DEMO_WEEKLY_HOURS >= 4 ? 2 : 1,
      focus,
      minutes: DEMO_WEEKLY_HOURS * 60,
    };
  }, []);

  return (
    <div className="tp-story">
      <section className="tp-panel tp-interactive">
        <div>
          <p className="tp-eyebrow">演示：目标到一周计划</p>
          <h2>看 Trellis 如何把模糊目标变成一周计划</h2>
          <p>
            下面是一段固定演示（每周 4 小时、先建立全局认知），展示产品逻辑：
            目标方向和每周时间会影响首周活动数量、主线重点和证据要求。
            正式诊断请进入「学习」页。
          </p>
        </div>
        <div className="tp-controls tp-controls-static">
          <span>
            每周时间
            <b>4 小时</b>
          </span>
          <span>
            目标倾向
            <b>先建立全局认知</b>
          </span>
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
          <div className="tp-stage-list tp-stage-static">
            {STAGES.map((stage) => (
              <div key={stage.id} className={activeStage === stage.id ? "active" : ""}>
                <span>{stage.label}</span>
                {stage.title}
              </div>
            ))}
          </div>
          <small className="tp-autoplay-hint">自动演示中</small>
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
            下面自动模拟一份证据的接受过程：接受后，对应节点会从成长中变为已验证；
            这才是 Trellis 的可信感来源。
          </p>
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
