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
      case "quiz":
        return this.quiz(input, minutes);
      case "reflection":
        return this.reflection(input, minutes);
      case "integrated_task":
        return this.integratedTask(input, minutes);
      case "retest":
        return this.retest(input, minutes);
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

  private quiz(input: ComposeActivityInput, minutes: number): ActivityDraft {
    return {
      nodeId: input.nodeId,
      activityType: "quiz",
      title: `小测验：${input.nodeTitle}`,
      goal: `回答 3 个自测题，检查对「${input.nodeTitle}」的理解是否到位。`,
      estimatedMinutes: minutes,
      inputRefs: input.resourceIds,
      steps: [
        "针对本节点写 3 个自测题（概念、边界、应用各一题）。",
        "先不看材料回答，再对照材料核对。",
        "对答错或不确定的题目，写明卡点是什么。",
        "把 3 题的回答与核对结果作为证据提交。",
      ],
      expectedEvidence: "3 个自测题的回答 + 核对结果 + 卡点说明",
      evaluationCriteria: "回答反映真实理解（不是抄材料）；能指出不确定处；卡点说明具体。",
      nextAdvice: "小测验暴露的薄弱点将进入下一周的活动编排。",
    };
  }

  private reflection(input: ComposeActivityInput, minutes: number): ActivityDraft {
    return {
      nodeId: input.nodeId,
      activityType: "reflection",
      title: `反思总结：${input.nodeTitle}`,
      goal: `复盘本周在「${input.nodeTitle}」上的收获与缺口，形成下一步依据。`,
      estimatedMinutes: minutes,
      inputRefs: input.resourceIds,
      steps: [
        "回顾本周学习材料与完成的活动。",
        "写收获：你比一周前多会了什么，能举一个具体例子。",
        "写缺口：哪里还不确定、哪里需要更多练习。",
        "给出下一步：继续、复习还是补前置，并说明理由。",
      ],
      expectedEvidence: "收获 + 缺口 + 下一步建议的复盘短文",
      evaluationCriteria: "收获有具体例子支撑；缺口真实具体；下一步建议与缺口对应。",
      nextAdvice: "复盘结论将作为调整建议的输入，驱动下周编排。",
    };
  }

  private retest(input: ComposeActivityInput, minutes: number): ActivityDraft {
    return {
      nodeId: input.nodeId,
      activityType: "retest",
      title: `延迟复测：${input.nodeTitle}`,
      goal: `复核「${input.nodeTitle}」是否仍然掌握：脱离材料完成一次验证。`,
      estimatedMinutes: minutes,
      inputRefs: [],
      steps: [
        "不看材料，独立回答 3 个验证题：概念、边界、应用各一题。",
        "对照评估量规自评：是否仍满足全部要点。",
        "对不确定的部分，说明卡点（复测失败会降低熟练等级并生成补强）。",
        "提交回答与自评作为复测证据。",
      ],
      expectedEvidence: "3 个验证题回答 + 对照量规的自评",
      evaluationCriteria: "回答反映持续掌握（非背诵）；能指出不确定处；自评诚实。",
      nextAdvice: "复测通过后下次复测间隔翻倍；失败则降低熟练等级并安排补强。",
    };
  }

  private integratedTask(input: ComposeActivityInput, minutes: number): ActivityDraft {
    return {
      nodeId: input.nodeId,
      activityType: "integrated_task",
      title: `综合情境：${input.nodeTitle}`,
      goal: `整合本周所学，完成一个真实场景任务，验证迁移能力。`,
      estimatedMinutes: minutes,
      inputRefs: input.resourceIds,
      steps: [
        "读题：用一个真实场景问题，覆盖本周节点的关键概念。",
        "先列方案思路（涉及哪些概念、彼此如何配合），再动手。",
        "完成产出：判断、方案、代码或作品，至少 500 字或等价产物。",
        "写自评：对照评估量规逐条说明达标情况。",
        "提交产出与自评作为证据。",
      ],
      expectedEvidence: "完整产出（判断/方案/代码/作品）+ 对照量规的自评",
      evaluationCriteria: "产出调动本周 ≥2 个节点的概念；结论可复核；说明适用边界与失败场景；自评与产出一致。",
      nextAdvice: "综合任务通过后，主节点熟练等级提升，进入下一节点或复测。",
    };
  }
}

export default RuleActivityComposer;
