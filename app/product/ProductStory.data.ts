// 产品宣传页演示数据（纯展示，不参与真实诊断）

export const STAGES = [
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

export const ROUTE_NODES = [
  { name: "AI 机制与边界", status: "validated", branch: "AI 通识与认知" },
  { name: "问题适配与人机职责", status: "growing", branch: "AI 通识与认知" },
  { name: "上下文与可核验使用", status: "growing", branch: "AI 通识与认知" },
  { name: "应用架构选择", status: "unstarted", branch: "AI 应用开发" },
  { name: "评测与人工确认", status: "unstarted", branch: "AI 产品经理" },
] as const;

export const STATUS_TEXT = {
  validated: "已验证",
  growing: "成长中",
  unstarted: "未点亮",
} as const;
