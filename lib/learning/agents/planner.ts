// planner — 规则实现（确定性）
// 路线规划：基于诊断自评 + 偏好，选择主路线并生成节点序列。
// 周计划编排：确定性——相同输入（含 seed）产生相同输出，刷新不重排。

import {
  findAdjacentBranches,
  learningContentPack,
} from "../domain/content.ts";
import type { ActivityType } from "../domain/types.ts";
import type {
  DiagnosticInput,
  PlannerPort,
  RouteProposal,
  WeeklyPlanDraft,
  WeeklyPlanInput,
} from "./types.ts";

// 每个路线的推荐节点序列（按学习顺序）
const ROUTE_SEQUENCE: Record<string, string[]> = {
  "ai-literacy": [
    "ai-literacy.mechanism",
    "ai-literacy.context",
    "ai-literacy.fit",
    "ai-literacy.architecture",
    "ai-literacy.evaluation",
    "ai-literacy.responsibility",
  ],
  "ai-app-dev": [
    "ai-app-dev.prompting",
    "ai-app-dev.rag",
    "ai-app-dev.tools",
    "ai-app-dev.eval-harness",
  ],
  "ai-product": [
    "ai-product.problem-def",
    "ai-product.capability-design",
    "ai-product.eval-decision",
  ],
};

export class RulePlanner implements PlannerPort {
  planLearningRoute(input: DiagnosticInput): RouteProposal {
    // 1. 计算各路线得分：自评中目标熟练等级达到 2+ 的节点数
    const scores: Record<string, number> = {};
    for (const routeId of Object.keys(ROUTE_SEQUENCE)) {
      const nodes = learningContentPack.nodes.filter((n) => n.routeId === routeId);
      const mastered = nodes.filter((n) => (input.selfReport[n.id] ?? 0) >= 2).length;
      scores[routeId] = mastered / Math.max(nodes.length, 1);
    }

    // 2. 选主路线：偏好 build_first 时应用开发优先，否则看自评最高分
    let routeId = "ai-literacy"; // 默认共同主干
    if (input.preference === "build_first") {
      routeId = scores["ai-app-dev"] >= 0.5 ? "ai-app-dev" : "ai-literacy";
    } else {
      // breadth_first：通识主干，除非已有明确领域自评
      const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
      routeId = best && best[1] >= 0.6 ? best[0] : "ai-literacy";
    }

    // 3. 生成节点序列：主干优先，跳过已掌握（>=2）的节点
    const sequence = ROUTE_SEQUENCE[routeId].filter(
      (nodeId) => (input.selfReport[nodeId] ?? 0) < 2,
    );

    // 4. 初始画像
    const strengths = learningContentPack.nodes
      .filter((n) => (input.selfReport[n.id] ?? 0) >= 2)
      .map((n) => n.title);
    const gaps = learningContentPack.nodes
      .filter((n) => n.routeId === routeId && (input.selfReport[n.id] ?? 0) < 2)
      .map((n) => n.title);

    // 5. 相邻分支
    const adjacent = findAdjacentBranches(routeId as never);

    const rationale =
      routeId === "ai-literacy"
        ? `从 AI 通识与认知开始建立共同主干，先理解模型机制、上下文使用与评估标准，再决定走向应用开发或产品经理分支。`
        : routeId === "ai-app-dev"
          ? `你已有应用开发基础，直接从提示工程与 RAG 开始，尽快产出可运行的应用原型。`
          : `你已有产品方向基础，从问题定义进入能力设计与评估决策，用证据支撑产品判断。`;

    return {
      routeId,
      nodeSequence: sequence,
      adjacentBranchIds: adjacent.map((b) => b.id),
      rationale,
      initialProfile: {
        strengths,
        gaps,
        recommendedFirstNodeId: sequence[0] ?? routeId,
      },
    };
  }

  composeWeeklyPlan(input: WeeklyPlanInput): WeeklyPlanDraft {
    // 确定性：用 seed 固定排序（无随机），相同输入相同输出
    const _seed = input.seed ?? 42;

    // 候选节点：当前路线中前置满足、未跳过、未验证的节点
    const routeNodes = learningContentPack.nodes.filter(
      (n) => n.routeId === input.routeId,
    );
    const candidates = routeNodes
      .filter((n) => {
        const status = input.nodeStatusById[n.id] ?? "unstarted";
        if (status === "validated") return false;
        if (input.skipNodeIds?.includes(n.id)) return false;
        return input.prerequisiteSatisfied(n.id);
      })
      .sort((a, b) => {
        // 确定性排序：优先级（growing 优先）→ 路线序列 → ID
        const seqA = ROUTE_SEQUENCE[input.routeId]?.indexOf(a.id) ?? 999;
        const seqB = ROUTE_SEQUENCE[input.routeId]?.indexOf(b.id) ?? 999;
        const statusA = input.nodeStatusById[a.id] ?? "unstarted";
        const statusB = input.nodeStatusById[b.id] ?? "unstarted";
        if (statusA !== statusB) return statusA === "growing" ? -1 : 1;
        if (seqA !== seqB) return seqA - seqB;
        return a.id.localeCompare(b.id);
      });

    // 6 类活动链（顺序 = 学习顺序；时长基准 = 6h 示例：45/45/90/30/30/120）
    // 每个节点只取该节点 activityTemplates 里允许的类型，类型不重复。
    const activityChain: Array<{ activityType: ActivityType; minutes: number; label: string; why: string }> = [
      { activityType: "build_model", minutes: 45, label: "建立模型", why: "先把概念、机制和边界说清楚，避免直接进入碎片练习。" },
      { activityType: "follow_demo", minutes: 45, label: "阅读与示范", why: "通过完整示例理解这个节点在真实任务中怎么用。" },
      { activityType: "independent_practice", minutes: 90, label: "动手实践", why: "用一个小产出验证是否能离开提示独立应用。" },
      { activityType: "quiz", minutes: 30, label: "小测验", why: "快速检查理解是否到位，暴露薄弱点。" },
      { activityType: "reflection", minutes: 30, label: "反思总结", why: "复盘收获与缺口，为下一周编排提供依据。" },
      { activityType: "integrated_task", minutes: 120, label: "综合情境", why: "整合本周所学完成一个真实任务，验证迁移能力。" },
    ];
    const selected: Array<typeof candidates[number] & { activityType: ActivityType; minutes: number; label: string; why: string }> = [];
    let committedMinutes = 0;
    const targetCoreCount = Math.min(8, Math.max(2, Math.floor(input.capacityMinutes / 60)));

    outer:
    for (const node of candidates) {
      for (const template of activityChain) {
        if (!node.activityTemplates.includes(template.activityType)) continue;
        if (selected.length >= targetCoreCount) break outer;
        if (committedMinutes + template.minutes > input.capacityMinutes) break outer;
        selected.push({ ...node, ...template });
        committedMinutes += template.minutes;
      }
    }

    const optionalSource = candidates.find((node) => !selected.some((item) => item.id === node.id)) ?? candidates[0];
    const optionalTemplates = optionalSource
      ? [
          { ...optionalSource, activityType: "follow_demo" as ActivityType, minutes: 45, label: "可选示范", why: "学有余力时看一个相邻例子，不影响本周核心承诺。" },
          { ...optionalSource, activityType: "independent_practice" as ActivityType, minutes: 45, label: "可选练习", why: "学有余力时做一个轻量变式，帮助迁移。" },
        ]
      : [];

    const plannedItems = [...selected, ...optionalTemplates.slice(0, 2)];
    const coreCount = selected.length;
    const optionalCount = plannedItems.length - coreCount;

    const activities = plannedItems.map((node, index) => {
      const isCore = index < coreCount;
      const status = input.nodeStatusById[node.id] ?? "unstarted";
      return {
        nodeId: node.id,
        activityType: node.activityType,
        title: `${node.label}：${node.title}`,
        estimatedMinutes: node.minutes,
        isCore,
        whyNow: node.why
          || (status === "growing"
            ? `节点 ${node.title} 已有基础但未验证，安排独立练习形成证据。`
            : `节点 ${node.title} 是当前路线的下一步，先建立模型再练习。`),
      };
    });

    const totalMinutes = committedMinutes;
    const remaining = input.capacityMinutes - committedMinutes;
    const rationale = `按 ${input.capacityMinutes} 分钟容量编排 ${coreCount} 个核心活动，承诺 ${committedMinutes} 分钟，剩余 ${remaining} 分钟作为缓冲/加深/修订时间；可选活动不计入承诺。周计划半稳定，普通完成不重排。`;

    return {
      weekKey: input.weekKey,
      coreActivityCount: coreCount,
      optionalActivityCount: optionalCount,
      totalMinutes,
      activities,
      rationale,
    };
  }
}

export default RulePlanner;
