// V0.2 learning application — 用例服务
// 编排闭环：诊断 → 路线确认 → 活动开始 → 证据提交 → 评估 → 节点状态 → 调整建议。
// 只依赖 LearningStore 接口与 Agent 接口，不直接触碰数据库实现。

import {
  learningContentPack,
  prerequisitesSatisfied,
  findAdjacentBranches,
  getPrerequisiteNodeIds,
} from "../domain/content.ts";
import {
  transitionActivity,
  transitionEvidence,
  transitionNode,
  nodeEventOfEvidence,
  decideSkip,
} from "../domain/state-machine.ts";
import type {
  AdjustmentRecord,
  Evidence,
  LearningActivity,
  NodeProgress,
  NodeStatus,
  WeeklyPlan,
} from "../domain/types.ts";
import type { AgentRegistry, ActivityDraft, EvidenceAssessment } from "../agents/types.ts";
import type { LearningStore, LearnerProfile } from "../persistence/store.ts";
import { InMemoryLearningStore } from "../persistence/in-memory.ts";
import { createRuleAgents } from "../agents/index.ts";

// ── 稳定 ID（与 V0.1 learning-server 同算法，前缀区分）────────
function stableId(prefix: string, value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16)}`;
}

// ── 当前周键（ISO 周）───────────────────────────────────
export function currentWeekKey(now = new Date()): string {
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ── 领域错误 ───────────────────────────────────────────
export class LearningError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// ── Workspace 读模型 ──────────────────────────────────
export interface Workspace {
  profile: LearnerProfile | null;
  route: {
    id: string;
    title: string;
    version: string;
    description: string;
  } | null;
  adjacentBranches: Array<{ id: string; name: string; description: string }>;
  weeklyPlan: WeeklyPlan | null;
  activities: LearningActivity[];
  nodeProgress: NodeProgress[];
  evidence: Evidence[];
  adjustments: AdjustmentRecord[];
  // 工作台：资源/工具与节点的映射
  workbench: {
    resources: Array<{
      resourceId: string;
      title: string;
      url: string;
      sourceType: string;
      credibilityLevel: number;
      summary: string;
      nodeId: string;
      usage: string;
    }>;
    tools: Array<{
      toolId: string;
      name: string;
      url: string;
      description: string;
      nodeId: string;
      usage: string;
      activityContext: string;
    }>;
  };
}

export class LearningApplicationService {
  private store: LearningStore;
  private agents: AgentRegistry;

  constructor(store: LearningStore, agents: AgentRegistry) {
    this.store = store;
    this.agents = agents;
  }

  // ── GET /api/learning/workspace ─────────────────────
  async getWorkspace(ownerId: string): Promise<Workspace> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) {
      return {
        profile: null,
        route: null,
        adjacentBranches: [],
        weeklyPlan: null,
        activities: [],
        nodeProgress: [],
        evidence: [],
        adjustments: [],
        workbench: { resources: [], tools: [] },
      };
    }

    const route = learningContentPack.routes.find((r) => r.id === profile.activeRouteId) ?? null;
    const adjacentBranches = route
      ? findAdjacentBranches(route.id as never).map((b) => ({
          id: b.id,
          name: b.name,
          description: b.description,
        }))
      : [];

    const weeklyPlan = await this.store.getWeeklyPlanByWeek(
      ownerId,
      profile.activeRouteId,
      currentWeekKey(),
    );
    const activities = weeklyPlan
      ? await this.store.listActivitiesByPlan(weeklyPlan.id)
      : [];
    const nodeProgress = await this.store.listNodeProgress(ownerId);
    const evidence: Evidence[] = [];
    for (const activity of activities) {
      evidence.push(...(await this.store.listEvidenceByActivity(activity.id)));
    }
    const adjustments = await this.store.listAdjustments(ownerId);

    // 工作台映射
    const resources = learningContentPack.resourceMappings
      .filter((m) => route && learningContentPack.nodes.some((n) => n.id === m.nodeId && n.routeId === route.id))
      .map((m) => {
        const resource = learningContentPack.resources.find((r) => r.id === m.resourceId)!;
        return {
          resourceId: resource.id,
          title: resource.title,
          url: resource.url,
          sourceType: resource.sourceType,
          credibilityLevel: resource.credibilityLevel,
          summary: resource.summary,
          nodeId: m.nodeId,
          usage: m.usage,
        };
      });
    const tools = learningContentPack.toolMappings
      .filter((m) => route && learningContentPack.nodes.some((n) => n.id === m.nodeId && n.routeId === route.id))
      .map((m) => {
        const tool = learningContentPack.tools.find((t) => t.id === m.toolId)!;
        return {
          toolId: tool.id,
          name: tool.name,
          url: tool.url,
          description: tool.description,
          nodeId: m.nodeId,
          usage: m.usage,
          activityContext: m.activityContext,
        };
      });

    return {
      profile,
      route,
      adjacentBranches,
      weeklyPlan,
      activities,
      nodeProgress,
      evidence,
      adjustments,
      workbench: { resources, tools },
    };
  }

  // ── POST /api/learning/diagnostic ───────────────────
  async runDiagnostic(input: {
    ownerId: string;
    goal: string;
    weeklyMinutes: number;
    materialIds?: string[];
    selfReport?: Record<string, number>;
    preference?: "breadth_first" | "build_first";
  }): Promise<Workspace> {
    const proposal = this.agents.planner.planLearningRoute({
      goal: input.goal,
      weeklyMinutes: input.weeklyMinutes,
      materialIds: input.materialIds ?? [],
      selfReport: input.selfReport ?? {},
      preference: input.preference ?? "breadth_first",
    });

    const profile: LearnerProfile = {
      id: stableId("profile", input.ownerId),
      ownerId: input.ownerId,
      goal: input.goal,
      activeRouteId: proposal.routeId,
      weeklyMinutes: input.weeklyMinutes,
      status: "proposed",
    };
    await this.store.saveProfile(profile);

    // 初始化节点进度：路线节点全部 unstarted（自评 >=2 的置 growing）
    for (const node of learningContentPack.nodes.filter((n) => n.routeId === proposal.routeId)) {
      const self = input.selfReport?.[node.id] ?? 0;
      const status: NodeStatus = self >= 2 ? "growing" : "unstarted";
      const existing = await this.store.getNodeProgress(input.ownerId, node.id);
      if (!existing) {
        await this.store.saveNodeProgress({
          id: stableId("nprogress", `${input.ownerId}:${node.id}`),
          ownerId: input.ownerId,
          nodeId: node.id,
          status,
          confidence: self,
          lastValidatedAt: null,
          supportingEvidenceIds: [],
        });
      }
    }

    return this.getWorkspace(input.ownerId);
  }

  // ── POST /api/learning/proposal/confirm ─────────────
  async confirmProposal(ownerId: string): Promise<Workspace> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) throw new LearningError("尚未完成诊断", 404);
    if (profile.status === "confirmed") throw new LearningError("路线已确认，无需重复确认", 400);

    profile.status = "confirmed";
    await this.store.saveProfile(profile);

    // 生成首周计划（确定性，同 seed 同输出）
    const weekKey = currentWeekKey();
    const nodeStatusById: Record<string, NodeStatus> = {};
    for (const p of await this.store.listNodeProgress(ownerId)) {
      nodeStatusById[p.nodeId] = p.status;
    }
    const planDraft = this.agents.planner.composeWeeklyPlan({
      ownerId,
      routeId: profile.activeRouteId,
      weekKey,
      capacityMinutes: profile.weeklyMinutes,
      nodeStatusById,
      prerequisiteSatisfied: (nodeId) =>
        prerequisitesSatisfied(nodeId, nodeStatusById, learningContentPack),
      seed: 42,
    });

    const weeklyPlan: WeeklyPlan = {
      id: stableId("plan", `${ownerId}:${profile.activeRouteId}:${weekKey}`),
      ownerId,
      routeId: profile.activeRouteId,
      weekKey,
      capacityMinutes: profile.weeklyMinutes,
      status: "confirmed",
      rationale: planDraft.rationale,
    };
    await this.store.saveWeeklyPlan(weeklyPlan);

    // 为每个计划活动生成具体活动
    let sequence = 0;
    for (const item of planDraft.activities) {
      const node = learningContentPack.nodes.find((n) => n.id === item.nodeId)!;
      const resourceIds = learningContentPack.resourceMappings
        .filter((m) => m.nodeId === item.nodeId)
        .map((m) => m.resourceId);
      const draft: ActivityDraft = this.agents.activityComposer.composeActivity({
        nodeId: item.nodeId,
        nodeTitle: node.title,
        nodeDescription: node.description,
        activityType: item.activityType,
        isSkipValidation: false,
        resourceIds,
        estimatedMinutes: item.estimatedMinutes,
      });
      const activity: LearningActivity = {
        id: stableId("activity", `${weeklyPlan.id}:${item.nodeId}:${item.activityType}`),
        ownerId,
        weeklyPlanId: weeklyPlan.id,
        nodeId: item.nodeId,
        title: draft.title,
        activityType: draft.activityType,
        goal: draft.goal,
        estimatedMinutes: draft.estimatedMinutes,
        isCore: item.isCore,
        status: "planned",
        isSkipValidation: false,
        inputRefs: draft.inputRefs,
        steps: draft.steps.join("\n"),
        expectedEvidence: draft.expectedEvidence,
        evaluationCriteria: draft.evaluationCriteria,
        nextAdvice: draft.nextAdvice,
        sequence,
      };
      await this.store.saveActivity(activity);
      sequence += 1;
    }

    return this.getWorkspace(ownerId);
  }

  // ── POST /api/learning/activities/:id/start ─────────
  async startActivity(ownerId: string, activityId: string): Promise<Workspace> {
    const activity = await this.getOwnedActivity(ownerId, activityId);
    const next = transitionActivity(activity.status, { type: "start" });
    activity.status = next;
    await this.store.saveActivity(activity);
    // 节点进入成长中
    const progress = await this.getOrCreateNodeProgress(ownerId, activity.nodeId);
    progress.status = transitionNode(progress.status, { type: "beginLearning" });
    await this.store.saveNodeProgress(progress);
    return this.getWorkspace(ownerId);
  }

  // ── POST /api/learning/activities/:id/evidence ──────
  async submitEvidence(
    ownerId: string,
    activityId: string,
    input: { content: string; externalUrl?: string; evidenceType?: Evidence["evidenceType"] },
  ): Promise<Workspace> {
    const activity = await this.getOwnedActivity(ownerId, activityId);
    if (!input.content.trim()) throw new LearningError("证据内容不能为空", 400);

    // 创建证据（draft → submitted）
    const evidence: Evidence = {
      id: stableId("evidence", `${activityId}:${input.content.length}:${Date.now()}`),
      ownerId,
      activityId,
      nodeId: activity.nodeId,
      evidenceType: input.evidenceType ?? "explanation",
      content: input.content,
      externalUrl: input.externalUrl ?? "",
      status: transitionEvidence("draft", { type: "submit" }),
      feedback: "",
    };
    await this.store.saveEvidence(evidence);

    // 活动进入 evidence_submitted
    const next = transitionActivity(activity.status, { type: "submitEvidence" });
    activity.status = next;
    await this.store.saveActivity(activity);

    return this.getWorkspace(ownerId);
  }

  // ── POST /api/learning/evidence/:id/review ──────────
  async reviewEvidence(ownerId: string, evidenceId: string): Promise<{
    workspace: Workspace;
    assessment: EvidenceAssessment;
  }> {
    const evidence = await this.store.getEvidence(evidenceId);
    if (!evidence || evidence.ownerId !== ownerId) {
      throw new LearningError("证据不存在", 404);
    }
    if (evidence.status !== "submitted") {
      throw new LearningError(`证据状态 ${evidence.status} 不允许评估`, 400);
    }
    const activity = await this.store.getActivity(evidence.activityId);
    if (!activity) throw new LearningError("活动不存在", 404);
    const node = learningContentPack.nodes.find((n) => n.id === evidence.nodeId);
    if (!node) throw new LearningError("节点不存在", 404);

    // 规则/LLM 评估
    const assessment = this.agents.evidenceEvaluator.evaluateEvidence({
      evidenceId,
      nodeId: evidence.nodeId,
      nodeTitle: node.title,
      targetLevel: node.targetLevel,
      evidenceType: evidence.evidenceType,
      content: evidence.content,
      criteria: activity.evaluationCriteria,
      isSkipValidation: activity.isSkipValidation,
    });

    // 证据状态迁移
    if (assessment.verdict === "accepted") {
      evidence.status = transitionEvidence(evidence.status, { type: "accept" });
      activity.status = transitionActivity(activity.status, { type: "reviewAccepted" });
    } else {
      evidence.status = transitionEvidence(evidence.status, { type: "requestRevision" });
      activity.status = transitionActivity(activity.status, { type: "reviewNeedsRevision" });
    }
    evidence.feedback = assessment.reasons.join("；") || assessment.missing.join("；");
    await this.store.saveEvidence(evidence);
    await this.store.saveActivity(activity);

    // 节点状态：证据 accepted 后驱动节点迁移
    const progress = await this.getOrCreateNodeProgress(ownerId, evidence.nodeId);
    if (assessment.verdict === "accepted") {
      const nodeEvent = nodeEventOfEvidence(evidence.status);
      if (nodeEvent) {
        progress.status = transitionNode(progress.status, nodeEvent);
        progress.confidence = Math.max(progress.confidence, assessment.suggestedLevel);
        progress.lastValidatedAt =
          progress.status === "validated" ? new Date().toISOString() : progress.lastValidatedAt;
        progress.supportingEvidenceIds = [
          ...new Set([...progress.supportingEvidenceIds, evidenceId]),
        ];
      }
      // 活动完成（评估通过后）
      if (activity.status === "reviewed") {
        activity.status = transitionActivity(activity.status, { type: "complete" });
        activity.nextAdvice = "证据已接受，进入下一步。";
        await this.store.saveActivity(activity);
      }
    }
    await this.store.saveNodeProgress(progress);

    // 调整建议（evidenceEvaluator 结论 → adjustmentAdvisor）
    const completionRate = await this.computeCompletionRate(ownerId);
    const skipped = await this.listSkippedNodeIds(ownerId);
    const prerequisiteGaps = assessment.nextAction === "insert_prerequisite"
      ? getPrerequisiteNodeIds(evidence.nodeId, learningContentPack)
      : [];
    const suggestion = this.agents.adjustmentAdvisor.suggestAdjustment({
      nodeId: evidence.nodeId,
      nodeTitle: node.title,
      evidenceVerdict: assessment.verdict,
      activityStatus: activity.status,
      completionRate,
      skippedNodeIds: skipped,
      prerequisiteGaps,
      routeId: (await this.store.getProfile(ownerId))?.activeRouteId ?? "",
    });
    if (suggestion.severity !== "low") {
      const adjustment: AdjustmentRecord = {
        id: stableId("adjustment", `${evidenceId}:${suggestion.adjustmentType}`),
        ownerId,
        routeId: (await this.store.getProfile(ownerId))?.activeRouteId ?? "",
        weeklyPlanId: activity.weeklyPlanId,
        adjustmentType: suggestion.adjustmentType,
        reason: suggestion.reason,
        status: "proposed",
        summary: suggestion.summary,
      };
      await this.store.saveAdjustment(adjustment);
    }

    return { workspace: await this.getWorkspace(ownerId), assessment };
  }

  // ── POST /api/learning/adjustments/:id/confirm ──────
  async confirmAdjustment(ownerId: string, adjustmentId: string): Promise<Workspace> {
    const adjustment = await this.store.getAdjustment(adjustmentId);
    if (!adjustment || adjustment.ownerId !== ownerId) {
      throw new LearningError("调整建议不存在", 404);
    }
    if (adjustment.status !== "proposed") {
      throw new LearningError(`调整建议状态 ${adjustment.status} 不允许确认`, 400);
    }
    adjustment.status = "accepted";
    await this.store.saveAdjustment(adjustment);
    return this.getWorkspace(ownerId);
  }

  // ── 跳学 ────────────────────────────────────────────
  async skipNode(ownerId: string, nodeId: string): Promise<Workspace> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) throw new LearningError("尚未完成诊断", 404);
    const progress = await this.getOrCreateNodeProgress(ownerId, nodeId);

    // 前置缺口不允许跳学
    const nodeStatusById: Record<string, NodeStatus> = {};
    for (const p of await this.store.listNodeProgress(ownerId)) nodeStatusById[p.nodeId] = p.status;
    const hasGap = !prerequisitesSatisfied(nodeId, nodeStatusById, learningContentPack);
    const decision = decideSkip(progress.status, hasGap);

    progress.status = decision.nodeStatus;
    await this.store.saveNodeProgress(progress);

    // 生成验证活动
    const node = learningContentPack.nodes.find((n) => n.id === nodeId)!;
    const weeklyPlan = await this.store.getWeeklyPlanByWeek(ownerId, profile.activeRouteId, currentWeekKey());
    const planId = weeklyPlan?.id ?? stableId("plan", `${ownerId}:${profile.activeRouteId}:${currentWeekKey()}`);
    const draft = this.agents.activityComposer.composeActivity({
      nodeId,
      nodeTitle: node.title,
      nodeDescription: node.description,
      activityType: "independent_practice",
      isSkipValidation: true,
      resourceIds: learningContentPack.resourceMappings
        .filter((m) => m.nodeId === nodeId)
        .map((m) => m.resourceId),
      estimatedMinutes: 45,
    });
    const activity: LearningActivity = {
      id: stableId("activity", `${planId}:${nodeId}:skip-validation`),
      ownerId,
      weeklyPlanId: planId,
      nodeId,
      title: draft.title,
      activityType: draft.activityType,
      goal: draft.goal,
      estimatedMinutes: draft.estimatedMinutes,
      isCore: false,
      status: "planned",
      isSkipValidation: true,
      inputRefs: draft.inputRefs,
      steps: draft.steps.join("\n"),
      expectedEvidence: draft.expectedEvidence,
      evaluationCriteria: draft.evaluationCriteria,
      nextAdvice: draft.nextAdvice,
      sequence: 99,
    };
    await this.store.saveActivity(activity);

    return this.getWorkspace(ownerId);
  }

  // ── 内部辅助 ────────────────────────────────────────
  private async getOwnedActivity(ownerId: string, activityId: string): Promise<LearningActivity> {
    const activity = await this.store.getActivity(activityId);
    if (!activity || activity.ownerId !== ownerId) {
      throw new LearningError("活动不存在", 404);
    }
    return activity;
  }

  private async getOrCreateNodeProgress(ownerId: string, nodeId: string): Promise<NodeProgress> {
    const existing = await this.store.getNodeProgress(ownerId, nodeId);
    if (existing) return existing;
    const progress: NodeProgress = {
      id: stableId("nprogress", `${ownerId}:${nodeId}`),
      ownerId,
      nodeId,
      status: "unstarted",
      confidence: 0,
      lastValidatedAt: null,
      supportingEvidenceIds: [],
    };
    await this.store.saveNodeProgress(progress);
    return progress;
  }

  private async computeCompletionRate(ownerId: string): Promise<number> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) return 0;
    const plan = await this.store.getWeeklyPlanByWeek(ownerId, profile.activeRouteId, currentWeekKey());
    if (!plan) return 0;
    const activities = await this.store.listActivitiesByPlan(plan.id);
    if (activities.length === 0) return 0;
    const completed = activities.filter((a) => a.status === "completed").length;
    return completed / activities.length;
  }

  private async listSkippedNodeIds(ownerId: string): Promise<string[]> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) return [];
    const plan = await this.store.getWeeklyPlanByWeek(ownerId, profile.activeRouteId, currentWeekKey());
    if (!plan) return [];
    const activities = await this.store.listActivitiesByPlan(plan.id);
    return activities.filter((a) => a.isSkipValidation).map((a) => a.nodeId);
  }
}

// ── 便捷工厂（测试/开发用内存实现）────────────────────
export function createLearningService(store?: LearningStore): LearningApplicationService {
  return new LearningApplicationService(
    store ?? new InMemoryLearningStore(),
    createRuleAgents(),
  );
}
