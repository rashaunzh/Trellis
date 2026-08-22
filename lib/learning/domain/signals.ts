// Evidence Review Engine — 能力信号数据（产品数据层，规则实现只读）
//
// 背景：Trellis 的能力信号曾经硬编码在规则版 evaluator 里
// （lib/learning/agents/evidence-evaluator.ts 的 NODE_SIGNAL_WORDS）。
// 本模块把它们抽成独立的产品数据，与算法代码解耦。
//
// 分层说明：
//   1. NODE_SIGNALS       —— 节点能力信号（短语级）：每个学习节点要求
//      证据体现的关键能力表现，由内容模型（node.signals）引用。
//      ⚠ 与评审行为耦合：改动节点信号即改变覆盖判定与评分，任何修改
//      需产品评审并同步回归测试。
//   2. CAPABILITY_SIGNALS —— 能力信号目录：跨节点复用的能力定义
//      （ID / 名称 / 判定关键词 / 语义描述 / 适用节点）。当前收录
//      Evidence Review 的核心能力信号；目录条目与 NODE_SIGNALS 中的
//      标签一一对应。
//   3. DEFAULT_SIGNALS    —— 通用兜底信号：所有节点评审都要求的最低信号。
//
// 规则版 evaluator 从本模块读取 DEFAULT_SIGNALS，并在输入未注入
// capabilitySignals 时回退到 getReviewSignalsForNode(nodeId)；
// 评分公式与输出结构定义在 agents/evidence-evaluator.ts。

export interface CapabilitySignal {
  /** 信号唯一 ID（产品数据主键） */
  id: string;
  /** 能力信号名称（与 NODE_SIGNALS 中的标签一致，产品文案用） */
  label: string;
  /** 判定关键词：证据文本中出现即视为该信号有对应内容 */
  keywords: string[];
  /** 语义描述：该能力信号证明学习者具备什么 */
  description: string;
  /** 适用节点（证据评审的 target node） */
  nodeIds: string[];
}

// ── 产品层：能力信号目录 ──────────────────────────────
export const CAPABILITY_SIGNALS: CapabilitySignal[] = [
  {
    id: "capability.test-question-design",
    label: "测试问题设计",
    keywords: ["测试问题", "测试集", "评测样例", "样例"],
    description: "能针对目标能力设计可验证的测试问题，覆盖正常、边界与失败场景。",
    nodeIds: ["ai-literacy.evaluation", "ai-app-dev.rag", "ai-app-dev.eval-harness"],
  },
  {
    id: "capability.standard-answer",
    label: "标准答案定义",
    keywords: ["标准答案", "参考答案", "预期输出", "判定标准"],
    description: "能为测试问题定义标准答案或预期输出，作为判定对错的基准。",
    nodeIds: ["ai-app-dev.rag", "ai-app-dev.eval-harness"],
  },
  {
    id: "capability.citation-hit",
    label: "引用命中判断",
    keywords: ["引用", "命中", "出处", "来源"],
    description: "能判断模型输出是否命中引用来源，区分有据回答与编造。",
    nodeIds: ["ai-app-dev.rag"],
  },
  {
    id: "capability.failure-taxonomy",
    label: "失败类型分类",
    keywords: ["失败类型", "失败分类", "幻觉", "拒答", "越界"],
    description: "能对评测中发现的失败进行类型化分类（如幻觉类、边界类、工具类），并给出升级标准。",
    nodeIds: ["ai-literacy.evaluation", "ai-app-dev.rag", "ai-app-dev.eval-harness"],
  },
  {
    id: "capability.product-improvement",
    label: "产品改进建议",
    keywords: ["改进", "建议", "下一步", "升级", "复盘"],
    description: "能基于评测结果提出具体的产品改进建议，形成评测→迭代闭环。",
    nodeIds: ["ai-product.eval-decision"],
  },
];

// ── 节点能力信号（短语级）─────────────────────────────
// 迁移自内容模型 node.signals（内容种子数据），逐字保留，不得在重构中改动。
// 内容包通过 `signals: NODE_SIGNALS["<nodeId>"]` 引用，保证单一数据源。
export const NODE_SIGNALS: Record<string, string[]> = {
  "ai-literacy.mechanism": ["训练机制解释", "概率推理说明", "幻觉风险识别", "泛化边界说明", "AI 与普通程序区分"],
  "ai-literacy.history": ["AI 发展时间线", "符号主义解释", "专家系统局限", "统计学习转向", "深度学习爆发条件"],
  "ai-literacy.fit": ["训练与推理区分", "数据学习解释", "规则方法适用判断", "学习方法适用判断", "失败边界说明"],
  "ai-literacy.context": ["数据集作用解释", "特征与标签区分", "数据分布理解", "泛化风险说明", "数据偏差识别"],
  "ai-literacy.architecture": ["环境运行记录", "输入输出说明", "Notebook 步骤复述", "案例机制解释", "运行结果解读"],
  "ai-literacy.evaluation": ["测试问题设计", "评估依据说明", "失败类型分类", "人工确认点设计", "指标或样例使用"],
  "ai-literacy.responsibility": ["风险类型识别", "缓解措施设计", "隐私权限判断", "偏见来源说明", "责任边界区分"],
  "ai-app-dev.prompting": ["任务说明明确", "材料边界设定", "输出格式控制", "提示版本对比", "结果差异解释"],
  "ai-app-dev.rag": ["RAG 链路说明", "测试问题设计", "标准答案定义", "引用命中判断", "无答案处理设计", "失败类型分类"],
  "ai-app-dev.tools": ["工具调用链路说明", "函数输入输出定义", "权限边界判断", "高风险确认点", "动作结果校验"],
  "ai-app-dev.eval-harness": ["测试集设计", "标准答案定义", "边界样例覆盖", "失败类型分类", "版本比较判断"],
  "ai-product.problem-def": ["用户场景描述", "问题陈述拆解", "成功标准定义", "方案与需求区分", "价值假设说明"],
  "ai-product.capability-design": ["能力清单拆解", "输入输出定义", "可评测标准", "能力边界说明", "人工兜底设计"],
  "ai-product.eval-decision": ["评测结果引用", "上线回滚判断", "用户感知指标", "系统指标区分", "产品改进建议"],
};

// ── 规则层：通用兜底信号 ──────────────────────────────
export const DEFAULT_SIGNALS: string[] = ["概念解释", "边界判断", "可复核产出", "自我校验"];

// ── 查询辅助（只读访问器）──────────────────────────────
/** 取某节点的能力信号（内容模型 node.signals 同源；无配置返回空数组） */
export function getReviewSignalsForNode(nodeId: string): string[] {
  return NODE_SIGNALS[nodeId] ?? [];
}

/** getReviewSignalsForNode 的别名（兼容重构中曾使用过的旧命名） */
export function getNodeSignalWords(nodeId: string): string[] {
  return getReviewSignalsForNode(nodeId);
}

/** 取适用某节点的能力信号目录条目 */
export function getCapabilitySignalsForNode(nodeId: string): CapabilitySignal[] {
  return CAPABILITY_SIGNALS.filter((signal) => signal.nodeIds.includes(nodeId));
}

// ── 数据校验 ──────────────────────────────────────────
// 与内容包 validateContentPack 同级的种子数据卫生检查：
// 信号数据是产品数据，损坏会静默改变评审行为，故提供显式校验入口。
export function validateSignalData(): void {
  const ids = new Set<string>();
  const catalogLabels = new Set<string>();
  for (const signal of CAPABILITY_SIGNALS) {
    if (ids.has(signal.id)) throw new Error(`信号数据校验失败：能力信号 ID 重复 ${signal.id}`);
    ids.add(signal.id);
    catalogLabels.add(signal.label);
    if (!signal.label.trim()) throw new Error(`信号数据校验失败：能力信号 ${signal.id} 缺少 label`);
    if (signal.keywords.length === 0) throw new Error(`信号数据校验失败：能力信号 ${signal.id} 缺少 keywords`);
    if (!signal.description.trim()) throw new Error(`信号数据校验失败：能力信号 ${signal.id} 缺少 description`);
    if (signal.nodeIds.length === 0) throw new Error(`信号数据校验失败：能力信号 ${signal.id} 缺少 nodeIds`);
  }
  const allNodeLabels = new Set<string>(Object.values(NODE_SIGNALS).flat());
  catalogLabels.forEach((label) => {
    if (!allNodeLabels.has(label)) {
      throw new Error(`信号数据校验失败：目录条目 "${label}" 未出现在任何节点的 NODE_SIGNALS 中`);
    }
  });
  for (const [nodeId, labels] of Object.entries(NODE_SIGNALS)) {
    if (labels.length === 0) throw new Error(`信号数据校验失败：节点 ${nodeId} 信号列表为空`);
    if (new Set(labels).size !== labels.length) {
      throw new Error(`信号数据校验失败：节点 ${nodeId} 存在重复信号`);
    }
  }
  if (DEFAULT_SIGNALS.length === 0) throw new Error("信号数据校验失败：DEFAULT_SIGNALS 为空");
}
