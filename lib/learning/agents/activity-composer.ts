// activityComposer — 规则实现
// 把节点拆成学习活动：三类活动模板，默认 30 + n×15 分钟。

import type { ActivityDraft, ActivityComposerPort, ComposeActivityInput } from "./types.ts";

export class RuleActivityComposer implements ActivityComposerPort {
  composeActivity(input: ComposeActivityInput): ActivityDraft {
    const estimatedMinutes = input.estimatedMinutes ?? 30;
    const minutes =
      estimatedMinutes >= 30 ? estimatedMinutes : 30 + Math.round(estimatedMinutes / 15) * 15;

    switch (input.activityType) {
      case "build_model":
        return this.buildModel(input, minutes);
      case "follow_demo":
        return this.followDemo(input, minutes);
      case "independent_practice":
        return this.independentPractice(input, minutes);
    }
  }

  private buildModel(input: ComposeActivityInput, minutes: number): ActivityDraft {
    return {
      nodeId: input.nodeId,
      activityType: "build_model",
      title: `建立模型：${input.nodeTitle}`,
      goal: `能用自己的话解释「${input.nodeTitle}」的核心机制，并画出与相邻概念的关系。`,
      estimatedMinutes: minutes,
      inputRefs: input.resourceIds,
      steps: [
        "通读输入材料，找出 3 个关键概念。",
        "用自己的话写一段 150-300 字的解释，说明机制和边界。",
        "画一张概念关系图（或文字结构），标出前置与相邻概念。",
        "写一句判断标准：什么情况下这个知识会失效。",
      ],
      expectedEvidence: "一段概念解释 + 概念关系图 + 失效条件判断",
      evaluationCriteria: "解释覆盖机制与边界；关系图包含至少 2 个相邻概念；判断标准可操作。",
      nextAdvice: "模型建立后，进入独立练习形成应用证据。",
    };
  }

  private followDemo(input: ComposeActivityInput, minutes: number): ActivityDraft {
    return {
      nodeId: input.nodeId,
      activityType: "follow_demo",
      title: `跟随示范：${input.nodeTitle}`,
      goal: `看懂一个完整例子，并解释例子为什么有效。`,
      estimatedMinutes: minutes,
      inputRefs: input.resourceIds,
      steps: [
        "完整看一遍示例（材料中的案例/代码/判断）。",
        "分步拆解：每一步做了什么、为什么这样做。",
        "写一段解释：这个例子为什么有效，关键设计决策是什么。",
        "指出例子的局限：什么情况下这个做法不适用。",
      ],
      expectedEvidence: "示例拆解 + 有效性解释 + 局限分析",
      evaluationCriteria: "拆解覆盖主要步骤；有效性解释指出关键设计决策；局限分析具体。",
      nextAdvice: "示范理解后，独立完成一个小产出验证应用能力。",
    };
  }

  private independentPractice(input: ComposeActivityInput, minutes: number): ActivityDraft {
    const skipPrefix = input.isSkipValidation ? "跳学验证：" : "";
    return {
      nodeId: input.nodeId,
      activityType: "independent_practice",
      title: `${skipPrefix}独立练习：${input.nodeTitle}`,
      goal: `独立完成一个小产出，证明能应用「${input.nodeTitle}」。`,
      estimatedMinutes: minutes,
      inputRefs: input.resourceIds,
      steps: [
        "选一个与本节点相关的真实小任务（prompt、代码片段、产品判断或学习笔记）。",
        "独立完成产出，不依赖逐步提示。",
        "对照评估标准自查：是否满足全部要点。",
        "提交产出作为证据，说明它为什么满足节点目标。",
      ],
      expectedEvidence: "一个独立完成的小产出（prompt/代码/判断/笔记）",
      evaluationCriteria: "产出满足节点目标；独立完成（无逐步提示）；自评与证据一致。",
      nextAdvice:
        input.isSkipValidation
          ? "跳学验证证据被接受后，节点进入已验证；不足则插入前置活动。"
          : "证据评估后进入下一步：继续、复习或补前置。",
    };
  }
}

export default RuleActivityComposer;
