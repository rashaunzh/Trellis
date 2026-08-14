// planner — 规则实现（确定性）
// 路线规划：基于诊断自评 + 偏好，选择主路线并生成节点序列。
// 周计划编排：确定性——相同输入（含 seed）产生相同输出，刷新不重排。

import {
  findAdjacentBranches,
  getPrerequisiteNodeIds,
  learningContentPack,
} from "../domain/content.ts";
import type { ActivityType, LearningActivity, NodeStatus } from "../domain/types.ts";
import type {
  DiagnosticInput,
  PlannerPort,
  RouteProposal,
  WeeklyPlanDraft,
  WeeklyPlanInput,
} from "./types.ts";

const PREREQUISITE = "prerequisite";

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
    const seed = input.seed ?? 42;

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

    // 打包活动：30 分钟基准，核心 2-4 个，可选 0-2 个
    const activityMinutes = (index: number) => 30 + (index % 2) * 15; // 30/45/30/45
    const coreCount = Math.min(4, Math.max(2, Math.floor(input.capacityMinutes / 90)));
    const optionalCount = Math.min(2, Math.max(0, candidates.length - coreCount));
    const selected = candidates.slice(0, coreCount + optionalCount);

    const activities = selected.map((node, index) => {
      const isCore = index < coreCount;
      const minutes = activityMinutes(index + (seed % 3));
      const status = input.nodeStatusById[node.id] ?? "unstarted";
      const activityType: ActivityType = status === "growing" ? "independent_practice" : "build_model";
      return {
        nodeId: node.id,
        activityType,
        title: node.title,
        estimatedMinutes: minutes,
        isCore,
        whyNow:
          status === "growing"
            ? `节点 ${node.title} 已有基础但未验证，安排独立练习形成证据。`
            : `节点 ${node.title} 是当前路线的下一步，先建立模型再练习。`,
      };
    });

    const totalMinutes = activities.reduce((s, a) => s + a.estimatedMinutes, 0);
    const rationale = `按 ${input.capacityMinutes} 分钟容量编排 ${coreCount} 个核心活动，周计划半稳定，普通完成不重排。`;

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
