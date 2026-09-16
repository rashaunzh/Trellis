// 能力信号数据层测试：信号是产品数据，锁定数据完整性 + evaluator 读取契约
// 1. 信号数据校验通过（ID 唯一、目录条目与节点信号一致）
// 2. 目录包含 Evidence Review 的 5 个核心能力信号
// 3. 节点信号覆盖内容包全部节点（与 node.signals 同源）
// 4. 规则版 evaluator 未注入 capabilitySignals 时从数据模块读取节点信号
import test from "node:test";
import assert from "node:assert/strict";

import {
  CAPABILITY_SIGNALS,
  DEFAULT_SIGNALS,
  NODE_SIGNALS,
  getReviewSignalsForNode,
  validateSignalData,
} from "../../lib/learning/domain/signals.ts";
import { learningContentPack } from "../../lib/learning/domain/content.ts";
import { createRuleAgents } from "../../lib/learning/agents/index.ts";

const REQUIRED_CAPABILITY_SIGNALS = [
  "测试问题设计",
  "标准答案定义",
  "引用命中判断",
  "失败类型分类",
  "产品改进建议",
];

test("信号数据通过校验（ID 唯一、目录与节点信号一致）", () => {
  assert.doesNotThrow(() => validateSignalData());
});

test("能力信号目录包含 5 个核心能力信号", () => {
  const labels = CAPABILITY_SIGNALS.map((signal) => signal.label);
  for (const required of REQUIRED_CAPABILITY_SIGNALS) {
    assert.ok(labels.includes(required), `目录缺少能力信号：${required}`);
  }
});

test("节点信号覆盖内容包全部节点，且与 node.signals 同源", () => {
  const contentNodes = learningContentPack.nodes;
  assert.ok(contentNodes.length >= 14, "内容包节点数应 ≥ 14");
  for (const node of contentNodes) {
    assert.ok(
      node.id in NODE_SIGNALS,
      `内容包节点 ${node.id} 缺少节点信号配置`,
    );
    assert.ok(NODE_SIGNALS[node.id].length > 0, `节点 ${node.id} 信号列表为空`);
    // node.signals 必须与数据模块同源（内容模型引用同一数据）
    assert.deepEqual(node.signals, NODE_SIGNALS[node.id], `节点 ${node.id} 的 node.signals 与数据模块不一致`);
  }
});

test("兜底信号保持既有定义", () => {
  assert.deepEqual(DEFAULT_SIGNALS, ["概念解释", "边界判断", "可复核产出", "自我校验"]);
});

test("规则版 evaluator 未注入 capabilitySignals 时从数据模块读取节点信号", async () => {
  const agents = createRuleAgents();
  const assessment = await agents.evidenceEvaluator.evaluateEvidence({
    evidenceId: "signal-contract-1",
    nodeId: "ai-literacy.evaluation",
    nodeTitle: "评测与实验验证",
    targetLevel: 3,
    evidenceType: "explanation",
    content: "测试问题设计：设计 5 个评测样例；标准答案定义：给出预期输出；引用命中判断：核对出处；失败类型分类：区分幻觉与边界类失败；产品改进建议：按失败分布排优先级。",
    criteria: "",
    isSkipValidation: false,
  });
  // 信号列表 = 节点信号（5 个）+ 兜底信号（4 个），无 criteria 信号、未达 9 上限截断
  const expectedLabels = [...NODE_SIGNALS["ai-literacy.evaluation"], ...DEFAULT_SIGNALS];
  const actualLabels = assessment.signalReviews.map((signal) => signal.label);
  assert.deepEqual(actualLabels, expectedLabels);
});

test("getReviewSignalsForNode 无配置节点返回空数组", () => {
  assert.deepEqual(getReviewSignalsForNode("no-such-node"), []);
});
