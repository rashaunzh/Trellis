import type { ScenarioCheck } from "./course-intelligence.ts";

type Case = { prompt: string; choices: [string, string, string]; answer: number; rubric: string[]; rationale: string };
const cases: Record<string, Case> = {
  "pm.problem-framing": {
    prompt: "访谈中三位用户说收藏了很多课程，其中两位从未打开收藏。你准备开发AI路线生成，下一步最应该验证什么？",
    choices: ["先统计用户收藏数量，用收藏越多越需要路线生成作为确定的需求结论。", "追问最近一次具体学习选择，观察卡在选择、时间还是执行，再验证路线建议能否改变行动。", "先提供更多课程和自动收藏功能，以更多资源覆盖所有可能的学习需求。"], answer: 1,
    rubric: ["区分用户陈述和真实行为", "辨别选择困难、时间不足和执行障碍", "用可观察行动检验价值假设"],
    rationale: "收藏多只是一条问题线索。应还原具体情境与替代办法，再验证路线建议是否改变学习选择和行动。",
  },
  "pm.eval-design": {
    prompt: "你用8个案例调好了路线提示词，其中有2例曾被称为保留集。现在8例全部通过，应该如何报告和继续验证？",
    choices: ["报告模型准确率100%，因为全部已知案例都通过，足以证明真实用户效果。", "把两例的名称修改后继续算保留集，这样可以保留原来设置的评估比例。", "报告开发案例结果，说明保留集已参与调试；另取未见样本独立评分，并比较相同输入的基线。"], answer: 2,
    rubric: ["识别评估污染", "区分结构通过、路线质量和用户效果", "同输入比较并保留逐例依据"],
    rationale: "参与调试的数据不再独立。小样本通过率不能直接解释为总体准确率，需新的未见样本和明确评分依据。",
  },
  "pm.interaction-fallback": {
    prompt: "AI发现某门课可能更适合用户，但用户已经确认本周路线并完成了一半。产品应该怎样处理这次建议？",
    choices: ["展示更换理由、影响和新旧差异，保留当前任务，用户确认后再切换路线。", "立即替换剩余任务并删除旧路线，让用户始终获得模型判断的最新最优方案。", "为了避免用户困惑，把推荐课程静默插入本周任务，保留原任务数量但延长用时。"], answer: 0,
    rubric: ["区分建议与已确认状态", "说明切换成本和影响", "保留恢复路径并经用户确认生效"],
    rationale: "路线变更影响既有承诺。建议应解释差异与代价，保留当前进度，并在明确确认后生效。",
  },
  "ai.capability-boundary": {
    prompt: "模型根据课程销售页判断课程值得购买，销售页写着保证收入翻倍，但没有提供就业数据。哪种结果表述最合理？",
    choices: ["销售页写了收入承诺，说明课程方对教学有信心，因此可以把它当作效果证据。", "引用该承诺并说明缺少核验依据，仅评估读到的公开内容；不能保证收益，也不能直接定性骗局。", "没有就业数据就足以证明这门课程是骗局，可以直接向用户推荐其他更贵的课程。"], answer: 1,
    rubric: ["区分来源说法和独立事实", "标明读取范围", "信息不足时不做过度确定判断"],
    rationale: "模型看到的是销售页说法，不能据此验证学习效果或收入结果。应展示原句、证据缺口和结论边界。",
  },
  "use.discernment": {
    prompt: "两份摘要都流畅完整，其中一份引文来自原文，另一份包含原文中找不到的数据。你会怎样选择与验证？",
    choices: ["优先选择语言更专业、数字更具体的摘要，因为这些特征意味着结论更可信。", "两份摘要由同一模型生成，因此质量相当，随机选择一份以减少决策成本。", "回到原文逐项核对关键结论和数字；无法支持的内容标记或删除，流畅度不能替代事实依据。"], answer: 2,
    rubric: ["核对关键事实与引用", "识别流畅性不等于正确性", "对不支持的结论保留不确定性"],
    rationale: "摘要的可信度来自原文支持，而非措辞或数字的丰富程度。发现无依据内容应标记并纠正。",
  },
};

export function taskScenario(activityId: string, nodeId: string): ScenarioCheck | null {
  const item = cases[nodeId];
  if (!item) return null;
  return { id: `scenario.${activityId}.node-v1`, activityId, nodeId, prompt: item.prompt,
    options: item.choices.map((text, index) => ({ id: `choice-${index + 1}`, text })),
    correctOptionId: `choice-${item.answer + 1}`, rationale: item.rationale,
    contractVersion: "scenario_check.v1", assessmentKind: "node_check", rubric: item.rubric };
}
