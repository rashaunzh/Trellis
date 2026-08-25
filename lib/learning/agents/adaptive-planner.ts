// 自适应路线规划（AdaptiveRoutePlanner）— 规则实现（确定性，纯函数）
//
// 本文件是"前半段补齐"的规则版 helper：消费 GoalAnalysis + CapabilityMap，
// 产出路线 / 有序能力 / 周计划 / 活动草稿 / 理由 / 模式。
//
// 定位与边界：
//   - 现有 RulePlanner（planner.ts）与 RuleActivityComposer（activity-composer.ts）
//     保持原样，作为内容包模式的既有路径与 fallback，本模块不替换它们。
//   - 本模块不接入服务层（不改 learning-service.ts）、不碰 UI、不改 DB schema。
//   - 未来接 AI 实现时，替换 AdaptivePlannerPort 的实现即可，契约不变。
//
// 关键规则（均确定性）：
//   1. 路线 = 目标能力 + 前置闭包；拓扑排序保证前置在前（环由校验先拦截）。
//   2. selfReport 达标（≥ 目标等级）的能力 = satisfied：保留在路线中（上下文），
//      但本周不排基础活动；selfReport ≥ 1 未达标 → 跳过建立模型/示范，直接独立练习。
//   3. 周计划按容量填充活动链，核心承诺 ≤ 容量；可选不计入承诺。
//   4. 活动草稿由能力信号参数化：expectedEvidence / completionCriteria /
//      evaluationCriteria 都引用 capability.signals，与 Evidence Review 的信号语义一致。

import type {
  ActivityType,
  LearningContentPack,
} from "../domain/types.ts";
import type {
  AdaptiveActivityDraft,
  AdaptivePlan,
  AdaptivePlannerInput,
  AdaptivePlannerPort,
  AdaptiveRoute,
  AdaptiveRouteNode,
  AdaptiveWeekItem,
  AdaptiveWeeklyPlan,
  Capability,
  CapabilityMap,
  ComposeAdaptiveActivityInput,
} from "./adaptive-types.ts";

// ── 默认活动链（阶段 = 学习顺序；对齐五阶段模型）────────
// 深度映射：1 理解 → [建立模型, 阅读示范]；2 应用 → + 独立练习；3 迁移 → + 情境应用。
// 复测（retest）与补强（focusSignals 独立练习）由 composer 单独支持，不进周计划默认链。
export const ADAPTIVE_ACTIVITY_CHAIN: Array<{
  activityType: ActivityType;
  minutes: number;
  label: string;
  why: string;
}> = [
  {
    activityType: "build_model",
    minutes: 45,
    label: "建立模型",
    why: "先把概念、机制与边界说清楚，避免直接进入碎片练习。",
  },
  {
    activityType: "follow_demo",
    minutes: 45,
    label: "阅读与示范",
    why: "通过完整示例理解该能力在真实任务中怎么用。",
  },
  {
    activityType: "independent_practice",
    minutes: 90,
    label: "独立练习",
    why: "脱离提示完成小产出，验证能否独立应用。",
  },
  {
    activityType: "integrated_task",
    minutes: 120,
    label: "情境应用",
    why: "整合多个能力完成真实场景任务，验证迁移。",
  },
];

// ── 工具函数 ──────────────────────────────────────────

/** FNV-1a 稳定哈希（与服务层 stableId 同算法，保证跨调用一致）。 */
export function fnv1a(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

/** ISO 周键（与服务层 currentWeekKey 同算法；agent 层不反向依赖 application 层）。 */
export function isoWeekKey(now = new Date()): string {
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** 时长归一化：≥30 分钟、15 分钟递增（与既有 composer 一致）。 */
export function normalizeMinutes(minutes: number): number {
  if (minutes < 30) return 30;
  return Math.round(minutes / 15) * 15;
}

// ── 内容包 → 通用能力图（兼容桥）───────────────────────
// 现有 learningContentPack 是单一数据源；投影后 adaptive 可以直接消费它，
// 不复制内容、不改内容包。mode = "content_pack"。
export function toCapabilityMap(pack: LearningContentPack): CapabilityMap {
  return {
    version: pack.version,
    source: "content_pack",
    capabilities: pack.nodes.map((n) => ({
      id: n.id,
      title: n.title,
      description: n.description,
      targetLevel: n.targetLevel,
      isMilestone: n.isKeyMilestone,
      signals: [...n.signals],
      activityTemplates: [...n.activityTemplates] as ActivityType[],
      sourceRefs: n.sourceRefs.map((ref) => ({ ...ref })),
    })),
    edges: pack.edges.map((e) => ({
      from: e.sourceNodeId,
      to: e.targetNodeId,
      relationType: e.relationType,
    })),
  };
}

// ── 能力图校验（与 validateContentPack 同级的卫生检查）──
export function validateCapabilityMap(map: CapabilityMap): void {
  const ids = new Set<string>();
  for (const cap of map.capabilities) {
    if (ids.has(cap.id)) throw new Error(`能力图校验失败：能力 ID 重复 ${cap.id}`);
    ids.add(cap.id);
    if (!cap.title.trim()) throw new Error(`能力图校验失败：能力 ${cap.id} 缺少 title`);
    if (cap.signals.length === 0) {
      throw new Error(`能力图校验失败：能力 ${cap.id} 缺少 signals`);
    }
    if (!Number.isInteger(cap.targetLevel) || cap.targetLevel < 0 || cap.targetLevel > 3) {
      throw new Error(`能力图校验失败：能力 ${cap.id} 的 targetLevel 非法 ${cap.targetLevel}`);
    }
  }
  for (const edge of map.edges) {
    if (!ids.has(edge.from)) throw new Error(`能力图校验失败：边 ${edge.from}→${edge.to} 的源能力不存在`);
    if (!ids.has(edge.to)) throw new Error(`能力图校验失败：边 ${edge.from}→${edge.to} 的目标能力不存在`);
  }
  // 前置边无环
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const cap of map.capabilities) {
    indegree.set(cap.id, 0);
    adjacency.set(cap.id, []);
  }
  for (const edge of map.edges) {
    if (edge.relationType !== "prerequisite") continue;
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    adjacency.get(edge.from)!.push(edge.to);
  }
  const remaining = map.capabilities.map((cap) => cap.id);
  let progress = true;
  while (remaining.length > 0 && progress) {
    progress = false;
    for (let i = 0; i < remaining.length; i += 1) {
      const id = remaining[i];
      if ((indegree.get(id) ?? 0) !== 0) continue;
      remaining.splice(i, 1);
      progress = true;
      for (const dep of adjacency.get(id) ?? []) {
        indegree.set(dep, (indegree.get(dep) ?? 0) - 1);
      }
      break;
    }
  }
  if (remaining.length > 0) {
    throw new Error(`能力图校验失败：前置关系存在环，涉及能力 ${remaining.join(", ")}`);
  }
}

// ── 图算法 ────────────────────────────────────────────

function capabilityById(map: CapabilityMap, id: string): Capability {
  const cap = map.capabilities.find((c) => c.id === id);
  if (!cap) throw new Error(`能力图缺少能力 ${id}`);
  return cap;
}

/** 前置闭包：目标能力 + 全部传递前置（prerequisite 入边反向 BFS）。 */
function prereqClosure(map: CapabilityMap, targets: string[]): string[] {
  const closure = new Set<string>();
  const stack = [...targets];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (closure.has(id)) continue;
    closure.add(id);
    for (const edge of map.edges) {
      if (edge.relationType === "prerequisite" && edge.to === id && !closure.has(edge.from)) {
        stack.push(edge.from);
      }
    }
  }
  return [...closure];
}

/**
 * 拓扑排序（Kahn，确定性）：
 *  - 广度优先（breadth_first）：候选按声明顺序取（跨模块广度展开）。
 *  - 先产出（build_first）：候选按"解锁依赖数最多优先"取（先打地基再上产出）。
 * 返回完整的学习顺序；若存在环（已被校验拦截）按剩余声明顺序兜底。
 */
function orderCapabilities(
  map: CapabilityMap,
  ids: string[],
  preference: AdaptivePlannerInput["preference"],
): string[] {
  const set = new Set(ids);
  const declarationIndex = new Map<string, number>();
  map.capabilities.forEach((cap, index) => declarationIndex.set(cap.id, index));

  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const id of set) {
    indegree.set(id, 0);
    dependents.set(id, []);
  }
  for (const edge of map.edges) {
    if (edge.relationType !== "prerequisite") continue;
    if (!set.has(edge.from) || !set.has(edge.to)) continue;
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    dependents.get(edge.from)!.push(edge.to);
  }

  const remaining = [...ids];
  const order: string[] = [];
  while (remaining.length > 0) {
    const ready = remaining
      .map((id, index) => ({ id, index }))
      .filter(({ id }) => (indegree.get(id) ?? 0) === 0);
    if (ready.length === 0) break; // 环（校验已拦截），按剩余声明顺序兜底
    ready.sort((a, b) => {
      if (preference === "build_first") {
        const depDiff = (dependents.get(b.id)?.length ?? 0) - (dependents.get(a.id)?.length ?? 0);
        if (depDiff !== 0) return depDiff;
      }
      return (declarationIndex.get(a.id) ?? 0) - (declarationIndex.get(b.id) ?? 0);
    });
    const pick = ready[0].id;
    const pickIndex = remaining.indexOf(pick);
    remaining.splice(pickIndex, 1);
    order.push(pick);
    for (const dep of dependents.get(pick) ?? []) {
      indegree.set(dep, (indegree.get(dep) ?? 0) - 1);
    }
  }
  order.push(...remaining);
  return order;
}

// ── 规则实现 ──────────────────────────────────────────

export class RuleAdaptiveRoutePlanner implements AdaptivePlannerPort {
  plan(input: AdaptivePlannerInput): AdaptivePlan {
    const { goalAnalysis, capabilityMap, preference } = input;
    validateCapabilityMap(capabilityMap);

    const selfReport = input.selfReport ?? {};
    const nodeStatusById = input.nodeStatusById ?? {};
    const targetIds = goalAnalysis.targetCapabilityIds ?? [];
    const targets = targetIds.length > 0 ? targetIds : [];

    // 1. 路线能力集合 = 目标 + 前置闭包（无目标时覆盖全图）
    const closureIds = prereqClosure(capabilityMap, targets.length > 0 ? targets : capabilityMap.capabilities.map((c) => c.id));
    const orderedIds = orderCapabilities(capabilityMap, closureIds, preference);

    // 2. 目标等级 = min(能力建议等级, 目标深度)；达标 = 自评达标或节点已验证
    const goalDepth = goalAnalysis.depth ?? 2;
    const effectiveLevel = (cap: Capability): number =>
      Math.min(cap.targetLevel, goalDepth);
    const isSatisfied = (cap: Capability): boolean =>
      nodeStatusById[cap.id] === "validated" || (selfReport[cap.id] ?? 0) >= effectiveLevel(cap);

    const routeNodes: AdaptiveRouteNode[] = orderedIds.map((id) => {
      const cap = capabilityById(capabilityMap, id);
      return {
        capabilityId: cap.id,
        title: cap.title,
        description: cap.description,
        targetLevel: cap.targetLevel,
        isMilestone: cap.isMilestone,
        prerequisiteIds: capabilityMap.edges
          .filter((e) => e.relationType === "prerequisite" && e.to === cap.id)
          .map((e) => e.from),
        supportingIds: capabilityMap.edges
          .filter((e) => e.relationType === "supports" && e.to === cap.id)
          .map((e) => e.from),
        signals: [...cap.signals],
        activityTemplates: cap.activityTemplates
          ? [...cap.activityTemplates]
          : ADAPTIVE_ACTIVITY_CHAIN.map((item) => item.activityType),
        sourceRefs: cap.sourceRefs ?? [],
        satisfied: isSatisfied(cap),
      };
    });

    const route: AdaptiveRoute = {
      routeId: `adaptive-${fnv1a(`${goalAnalysis.goal}|${orderedIds.join(",")}`)}`,
      title: `面向「${goalAnalysis.goal}」的自适应路线`,
      description:
        `由 CapabilityMap v${capabilityMap.version} 生成：${routeNodes.length} 个能力、` +
        `${capabilityMap.edges.filter((e) => e.relationType === "prerequisite").length} 条前置关系。`,
      version: capabilityMap.version,
      nodeIds: orderedIds,
      nodes: routeNodes,
      edges: capabilityMap.edges.filter(
        (e) => orderedIds.includes(e.from) && orderedIds.includes(e.to),
      ),
    };

    // 3. 周计划（确定性）：候选 = 前置已满足、未达标、未跳过的能力
    const routeNodeById = new Map(routeNodes.map((n) => [n.capabilityId, n]));
    const candidates = routeNodes.filter((node) => {
      if (node.satisfied) return false;
      return node.prerequisiteIds.every((prereqId) => {
        const prereq = routeNodeById.get(prereqId);
        return prereq?.satisfied ?? true;
      });
    });

    const weeklyPlan = this.composeAdaptiveWeek(
      input,
      candidates,
      routeNodeById,
      selfReport,
    );

    // 4. 活动草稿：每个周计划条目 → 能力信号参数化草稿
    const activities = weeklyPlan.activities.map((item) => {
      const cap = capabilityById(capabilityMap, item.capabilityId);
      return composeAdaptiveActivity({
        capability: cap,
        activityType: item.activityType,
        estimatedMinutes: item.estimatedMinutes,
        inputRefs: this.inputRefsFor(cap, input.materials),
        integrateCapabilityIds: orderedIds,
        // 周计划排入的是非补强/非跳学条目；补强与复测由服务层单独调用
        isSkipValidation: false,
      });
    });

    const satisfiedTitles = routeNodes.filter((n) => n.satisfied).map((n) => n.title);
    const rationale =
      `目标「${goalAnalysis.goal}」（深度 ${goalDepth}）按 ${preference === "build_first" ? "先产出" : "广度优先"} 拆解为 ${routeNodes.length} 个能力，` +
      `按前置关系排序；${satisfiedTitles.length > 0 ? `已达标跳过基础活动：${satisfiedTitles.join("、")}；` : ""}` +
      weeklyPlan.rationale;

    return {
      route,
      orderedCapabilities: routeNodes,
      weeklyPlan,
      activities,
      rationale,
      mode: capabilityMap.source === "content_pack" ? "content_pack" : "generic",
    };
  }

  // 周计划编排（确定性填充，语义与 RulePlanner.composeWeeklyPlan 对齐）
  private composeAdaptiveWeek(
    input: AdaptivePlannerInput,
    candidates: AdaptiveRouteNode[],
    routeNodeById: Map<string, AdaptiveRouteNode>,
    selfReport: Record<string, number>,
  ): AdaptiveWeeklyPlan {
    const capacity = input.weeklyMinutes;
    const weekKey = input.weekKey ?? isoWeekKey();

    const chainFor = (node: AdaptiveRouteNode): typeof ADAPTIVE_ACTIVITY_CHAIN => {
      const depth = input.goalAnalysis.depth ?? 2;
      const depthItems = ADAPTIVE_ACTIVITY_CHAIN.filter((item) => {
        if (depth === 1) {
          return item.activityType === "build_model" || item.activityType === "follow_demo";
        }
        if (depth === 2) {
          return item.activityType !== "integrated_task";
        }
        return true;
      });
      // 已有基础（自评 ≥1 未达标）→ 跳过建立模型与示范，直接独立练习
      const hasFoundation = (selfReport[node.capabilityId] ?? 0) >= 1;
      const filtered = hasFoundation
        ? depthItems.filter((item) => item.activityType !== "build_model" && item.activityType !== "follow_demo")
        : depthItems;
      return filtered.filter((item) => node.activityTemplates.includes(item.activityType));
    };

    const targetCoreCount = Math.min(8, Math.max(2, Math.floor(capacity / 60)));
    const selected: AdaptiveWeekItem[] = [];
    let committed = 0;

    for (const node of candidates) {
      for (const template of chainFor(node)) {
        if (selected.length >= targetCoreCount) break;
        if (committed + template.minutes > capacity) break;
        selected.push({
          capabilityId: node.capabilityId,
          activityType: template.activityType,
          title: `${template.label}：${node.title}`,
          estimatedMinutes: template.minutes,
          isCore: true,
          whyNow:
            (selfReport[node.capabilityId] ?? 0) >= 1
              ? `能力「${node.title}」已有基础但未达标，跳过基础活动直接形成应用证据。`
              : template.why,
        });
        committed += template.minutes;
      }
    }

    // 极小容量兜底：至少 1 个合法活动（时长 = min(链首推荐, 容量取整到 15 分钟)）
    if (selected.length === 0 && capacity >= 30 && candidates.length > 0) {
      const node = candidates[0];
      const template = chainFor(node)[0];
      if (template) {
        const minutes = Math.min(
          template.minutes,
          Math.max(30, Math.floor(capacity / 15) * 15),
        );
        selected.push({
          capabilityId: node.capabilityId,
          activityType: template.activityType,
          title: `${template.label}：${node.title}`,
          estimatedMinutes: minutes,
          isCore: true,
          whyNow: template.why,
        });
        committed = minutes;
      }
    }

    // 可选活动：第一个未被排入核心的能力（兜底 candidates[0]），2 个 45 分钟条目
    const optionalSource =
      candidates.find((node) => !selected.some((item) => item.capabilityId === node.capabilityId)) ??
      candidates[0];
    const optionals: AdaptiveWeekItem[] = [];
    if (optionalSource) {
      for (const activityType of ["follow_demo", "independent_practice"] as const) {
        if (!optionalSource.activityTemplates.includes(activityType)) continue;
        if (optionals.length >= 2) break;
        optionals.push({
          capabilityId: optionalSource.capabilityId,
          activityType,
          title: `可选${activityType === "follow_demo" ? "示范" : "练习"}：${optionalSource.title}`,
          estimatedMinutes: 45,
          isCore: false,
          whyNow: "学有余力时做的轻量变式，不影响本周核心承诺。",
        });
      }
    }

    const items = [...selected, ...optionals];
    const coreCount = selected.length;
    const optionalCount = items.length - coreCount;
    const remaining = capacity - committed;
    const modeNote = input.capabilityMap.source === "content_pack" ? "内容包投影" : "通用能力图";
    const rationale =
      `按 ${capacity} 分钟容量（${modeNote}）编排 ${coreCount} 个核心活动，承诺 ${committed} 分钟，` +
      `剩余 ${remaining} 分钟作为缓冲/加深/修订时间；可选活动不计入承诺。` +
      `周计划半稳定，普通完成不重排。`;

    return {
      weekKey,
      capacityMinutes: capacity,
      coreActivityCount: coreCount,
      optionalActivityCount: optionalCount,
      totalMinutes: committed,
      activities: items,
      rationale,
    };
  }

  private inputRefsFor(
    cap: Capability,
    materials: AdaptivePlannerInput["materials"],
  ): string[] {
    const materialIds =
      materials
        ?.filter((m) => (m.coveredCapabilityIds ?? []).includes(cap.id))
        .map((m) => m.materialId) ?? [];
    return [...new Set(materialIds)];
  }
}

export default RuleAdaptiveRoutePlanner;

// ── 能力信号驱动的活动组合器 ───────────────────────────
// 五阶段：建立模型 / 阅读示范 / 独立练习 / 情境应用 / 复测·补强。
// expectedEvidence / completionCriteria / evaluationCriteria 均由能力信号参数化，
// 与 Evidence Review 的 capabilitySignals 语义一致，避免"泛化模板不落地"。

export function composeAdaptiveActivity(input: ComposeAdaptiveActivityInput): AdaptiveActivityDraft {
  const minutes = normalizeMinutes(input.estimatedMinutes ?? 30);
  const { capability, activityType } = input;
  const signals = capability.signals.length > 0 ? capability.signals : ["概念解释", "边界判断"];

  const base = {
    capabilityId: capability.id,
    estimatedMinutes: minutes,
    inputRefs: input.inputRefs ?? [],
  };

  switch (activityType) {
    case "build_model":
      return {
        ...base,
        activityType,
        title: `建立模型：${capability.title}`,
        goal: `能用自己的话解释「${capability.title}」的机制与边界，并画出与相邻能力的关系。`,
        steps: [
          "通读输入材料，找出本能力的关键概念。",
          `用自己的话写一段 150-300 字的解释，覆盖能力信号：${signals.join("、")}。`,
          "画一张概念关系图（或文字结构），标出前置与相邻能力。",
          "写一句失效条件：什么情况下这个能力会失灵。",
        ],
        expectedEvidence: `概念解释覆盖能力信号（${signals.join("、")}）+ 关系图 + 失效条件`,
        completionCriteria: `解释覆盖全部能力信号（${signals.join("、")}）；关系图包含至少 1 个前置或相邻能力；失效条件可操作。`,
        evaluationCriteria: `解释覆盖全部能力信号（${signals.join("、")}）；关系图包含至少 1 个前置或相邻能力；失效条件可操作。`,
        nextAdvice: "模型建立后，进入独立练习形成应用证据。",
      };
    case "follow_demo":
      return {
        ...base,
        activityType,
        title: `跟随示范：${capability.title}`,
        goal: `看懂一个完整示例，并解释示例为什么有效。`,
        steps: [
          "完整看一遍示例（材料中的案例/代码/判断）。",
          "分步拆解：每一步做了什么、为什么这样做。",
          `指出示例如何体现能力信号：${signals.join("、")}。`,
          "指出示例的局限：什么情况下这个做法不适用。",
        ],
        expectedEvidence: `示例拆解 + 有效性解释（对应信号：${signals.join("、")}）+ 局限分析`,
        completionCriteria: "拆解覆盖主要步骤；有效性解释指出关键设计决策；局限分析具体。",
        evaluationCriteria: "拆解覆盖主要步骤；有效性解释指出关键设计决策；局限分析具体。",
        nextAdvice: "示范理解后，独立完成一个小产出验证应用能力。",
      };
    case "independent_practice": {
      const prefix = input.isSkipValidation ? "跳学验证：" : input.focusSignals?.length ? "补强练习：" : "";
      const focusNote =
        input.focusSignals?.length
          ? `重点覆盖缺失信号：${input.focusSignals.join("、")}。`
          : "";
      return {
        ...base,
        activityType,
        title: `${prefix}独立练习：${capability.title}`,
        goal: `独立完成一个小产出，证明能应用「${capability.title}」。`,
        steps: [
          "选一个与本能力相关的真实小任务（prompt、代码片段、产品判断或学习笔记）。",
          `独立完成产出，不依赖逐步提示。${focusNote}`,
          "对照评估标准自查：是否满足全部要点。",
          "提交产出作为证据，说明它为什么满足本能力目标。",
        ],
        expectedEvidence: `独立产出体现能力信号（${signals.join("、")}）`,
        completionCriteria:
          `产出满足能力目标；独立完成（无逐步提示）；覆盖信号 ${signals.join("、")}；自评与证据一致。`,
        evaluationCriteria:
          `产出满足能力目标；独立完成（无逐步提示）；覆盖信号 ${signals.join("、")}；自评与证据一致。`,
        nextAdvice: input.isSkipValidation
          ? "跳学验证证据被接受后，能力进入已验证；不足则插入前置活动。"
          : "证据评估后进入下一步：继续、复习或补前置。",
      };
    }
    case "integrated_task": {
      const scope = input.integrateCapabilityIds?.length
        ? input.integrateCapabilityIds
        : [capability.id];
      return {
        ...base,
        activityType,
        title: `情境应用：${capability.title}`,
        goal: `整合 ${scope.length} 个能力完成一个真实场景任务，验证迁移能力。`,
        steps: [
          "读题：用一个真实场景问题，覆盖目标能力的关键信号。",
          "先列方案思路（涉及哪些能力、彼此如何配合），再动手。",
          "完成产出：判断、方案、代码或作品，至少 500 字或等价产物。",
          `写自评：对照能力信号（${signals.join("、")}）逐条说明达标情况。`,
          "提交产出与自评作为证据。",
        ],
        expectedEvidence: `完整产出 + 对照信号（${signals.join("、")}）的自评`,
        completionCriteria:
          `产出调动 ≥2 个能力（${scope.join("、")}）；结论可复核；说明适用边界与失败场景；自评与产出一致。`,
        evaluationCriteria:
          `产出调动 ≥2 个能力（${scope.join("、")}）；结论可复核；说明适用边界与失败场景；自评与产出一致。`,
        nextAdvice: "情境任务通过后，主能力熟练等级提升，进入下一能力或复测。",
      };
    }
    case "retest":
      return {
        ...base,
        activityType,
        title: `延迟复测：${capability.title}`,
        goal: `复核「${capability.title}」是否仍然掌握：脱离材料完成一次验证。`,
        steps: [
          "不看材料，独立回答 3 个验证题：概念、边界、应用各一题。",
          `对照能力信号（${signals.join("、")}）自评：是否仍满足全部要点。`,
          "对不确定的部分，说明卡点（复测失败会降低熟练等级并生成补强）。",
          "提交回答与自评作为复测证据。",
        ],
        expectedEvidence: `3 个验证题回答 + 对照信号（${signals.join("、")}）的自评`,
        completionCriteria: "回答反映持续掌握（非背诵）；覆盖信号；自评诚实。",
        evaluationCriteria: "回答反映持续掌握（非背诵）；覆盖信号；自评诚实。",
        nextAdvice: "复测通过后下次复测间隔翻倍；失败则降低熟练等级并安排补强。",
      };
    case "quiz":
      return {
        ...base,
        activityType,
        title: `小测验：${capability.title}`,
        goal: `回答 3 个自测题，检查对「${capability.title}」的理解是否到位。`,
        steps: [
          "针对本能力写 3 个自测题（概念、边界、应用各一题）。",
          "先不看材料回答，再对照材料核对。",
          "对答错或不确定的题目，写明卡点是什么。",
          "把 3 题的回答与核对结果作为证据提交。",
        ],
        expectedEvidence: `3 个自测题的回答 + 核对结果 + 卡点说明（对照信号：${signals.join("、")}）`,
        completionCriteria: "回答反映真实理解（不是抄材料）；能指出不确定处；卡点说明具体。",
        evaluationCriteria: "回答反映真实理解（不是抄材料）；能指出不确定处；卡点说明具体。",
        nextAdvice: "小测验暴露的薄弱点将进入下一周的活动编排。",
      };
    case "reflection":
      return {
        ...base,
        activityType,
        title: `反思总结：${capability.title}`,
        goal: `复盘本周在「${capability.title}」上的收获与缺口，形成下一步依据。`,
        steps: [
          "回顾本周学习材料与完成的活动。",
          "写收获：你比一周前多会了什么，能举一个具体例子。",
          `写缺口：对照能力信号（${signals.join("、")}）说明哪里还不确定。`,
          "给出下一步：继续、复习还是补前置，并说明理由。",
        ],
        expectedEvidence: "收获 + 缺口 + 下一步建议的复盘短文",
        completionCriteria: "收获有具体例子支撑；缺口真实具体；下一步建议与缺口对应。",
        evaluationCriteria: "收获有具体例子支撑；缺口真实具体；下一步建议与缺口对应。",
        nextAdvice: "复盘结论将作为调整建议的输入，驱动下周编排。",
      };
    default:
      throw new Error(`未知活动类型 ${activityType}`);
  }
}
