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
  AdjustmentType,
  Evidence,
  LearningActivity,
  UserResource,
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
  // 当前路线的边（前置关系），成长页树状图使用
  edges: Array<{
    sourceNodeId: string;
    targetNodeId: string;
    relationType: "prerequisite" | "supports" | "related";
  }>;
  weeklyPlan: WeeklyPlan | null;
  activities: LearningActivity[];
  // 节点进度带中文标题（内容包为唯一真相，前端不再维护标题映射）
  nodeProgress: Array<NodeProgress & { title: string }>;
  evidence: Evidence[];
  adjustments: AdjustmentRecord[];
  // 工作台：资源/工具与节点的映射
  userResources: UserResource[];
  // 到期复测节点（延迟复测提醒）
  dueReviews: Array<{ nodeId: string; title: string; daysSinceValidated: number; nextReviewAt: string | null }>;
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
        edges: [],
        weeklyPlan: null,
        activities: [],
        nodeProgress: [],
        evidence: [],
        adjustments: [],
        userResources: [],
        dueReviews: [],
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
    const nodeProgress = (await this.store.listNodeProgress(ownerId)).map((p) => ({
      ...p,
      // 中文标题来自内容包（单一真相），不落库
      title: learningContentPack.nodes.find((n) => n.id === p.nodeId)?.title ?? p.nodeId,
    }));
    const evidence: Evidence[] = [];
    for (const activity of activities) {
      evidence.push(...(await this.store.listEvidenceByActivity(activity.id)));
    }
    const adjustments = await this.store.listAdjustments(ownerId);
    const userResources = await this.store.listUserResources(ownerId);
    // 到期复测：validated 节点且 nextReviewAt 已过（或 lastValidatedAt + 间隔已过）
    const now = Date.now();
    const dueReviews = nodeProgress
      .filter((p) => p.status === "validated")
      .map((p) => {
        const node = learningContentPack.nodes.find((n) => n.id === p.nodeId);
        const dueAt = p.nextReviewAt
          ? new Date(p.nextReviewAt).getTime()
          : p.lastValidatedAt
            ? new Date(p.lastValidatedAt).getTime() + p.reviewIntervalDays * 86400000
            : Infinity;
        return {
          nodeId: p.nodeId,
          title: node?.title ?? p.nodeId,
          daysSinceValidated: p.lastValidatedAt
            ? Math.floor((now - new Date(p.lastValidatedAt).getTime()) / 86400000)
            : 0,
          nextReviewAt: p.nextReviewAt,
          dueAt,
        };
      })
      .filter((d) => d.dueAt <= now)
      .map(({ dueAt: _dueAt, ...rest }) => rest);

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

    // 当前路线的边（前置/支持/相关），成长页树状图使用
    const routeNodeIds = new Set(
      learningContentPack.nodes.filter((n) => n.routeId === route?.id).map((n) => n.id),
    );
    const edges = learningContentPack.edges
      .filter((e) => routeNodeIds.has(e.sourceNodeId) && routeNodeIds.has(e.targetNodeId))
      .map((e) => ({
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        relationType: e.relationType,
      }));

    return {
      profile,
      route,
      adjacentBranches,
      edges,
      weeklyPlan,
      activities,
      nodeProgress,
      evidence,
      adjustments,
      userResources,
      dueReviews,
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
          confirmedAt: null,
          reviewIntervalDays: 14,
          nextReviewAt: null,
          reviewCount: 0,
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

    await this.createActivitiesFromPlanDraft(ownerId, weeklyPlan, planDraft.activities, 0);

    return this.getWorkspace(ownerId);
  }

  // ── POST /api/learning/replan ──────────────────────
  // 温和重排：保留节点进度、证据和已产生证据的活动，只清理本周未产生证据的开放活动。
  async replanCurrentWeek(ownerId: string, input: { weeklyMinutes?: number } = {}): Promise<Workspace> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) throw new LearningError("尚未完成诊断", 404);
    if (profile.status !== "confirmed") throw new LearningError("路线尚未确认，不能重排本周", 400);

    const nextWeeklyMinutes = input.weeklyMinutes
      ? Math.min(1200, Math.max(30, Math.round(input.weeklyMinutes / 15) * 15))
      : profile.weeklyMinutes;
    profile.weeklyMinutes = nextWeeklyMinutes;
    await this.store.saveProfile(profile);

    const weekKey = currentWeekKey();
    const nodeStatusById: Record<string, NodeStatus> = {};
    for (const p of await this.store.listNodeProgress(ownerId)) {
      nodeStatusById[p.nodeId] = p.status;
    }
    const planDraft = this.agents.planner.composeWeeklyPlan({
      ownerId,
      routeId: profile.activeRouteId,
      weekKey,
      capacityMinutes: nextWeeklyMinutes,
      nodeStatusById,
      prerequisiteSatisfied: (nodeId) =>
        prerequisitesSatisfied(nodeId, nodeStatusById, learningContentPack),
      seed: Date.now(),
    });

    const weeklyPlan: WeeklyPlan = {
      id: stableId("plan", `${ownerId}:${profile.activeRouteId}:${weekKey}`),
      ownerId,
      routeId: profile.activeRouteId,
      weekKey,
      capacityMinutes: nextWeeklyMinutes,
      status: "confirmed",
      rationale: `${planDraft.rationale} 本周已按用户请求重新编排；已提交证据与已完成记录保留。`,
    };
    await this.store.saveWeeklyPlan(weeklyPlan);

    await this.store.clearOpenActivitiesForPlan(ownerId, weeklyPlan.id);
    const existing = await this.store.listActivitiesByPlan(weeklyPlan.id);
    const nextSequence = existing.length
      ? Math.max(...existing.map((activity) => activity.sequence)) + 1
      : 0;
    await this.createActivitiesFromPlanDraft(ownerId, weeklyPlan, planDraft.activities, nextSequence);

    const adjustment: AdjustmentRecord = {
      id: stableId("adjustment", `${ownerId}:${weeklyPlan.id}:replan:${Date.now()}`),
      ownerId,
      routeId: profile.activeRouteId,
      weeklyPlanId: weeklyPlan.id,
      adjustmentType: "activity_replan",
      reason: "用户主动重排本周计划",
      status: "accepted",
      summary: `本周计划已重排为 ${planDraft.coreActivityCount} 个核心活动、${planDraft.optionalActivityCount} 个可选活动；保留已产生证据的学习记录。`,
    };
    await this.store.saveAdjustment(adjustment);

    return this.getWorkspace(ownerId);
  }

  // ── POST /api/learning/activities/:id/start ─────────
  async startActivity(ownerId: string, activityId: string): Promise<Workspace> {
    const activity = await this.getOwnedActivity(ownerId, activityId);
    const next = transitionActivity(activity.status, { type: "start" });
    activity.status = next;
    await this.store.saveActivity(activity);
    // 节点进入成长中（已验证节点开始复测活动不降级，保持 validated）
    const progress = await this.getOrCreateNodeProgress(ownerId, activity.nodeId);
    if (progress.status !== "validated") {
      progress.status = transitionNode(progress.status, { type: "beginLearning" });
      await this.store.saveNodeProgress(progress);
    }
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
      extractedJson: "{}",
      reviewJson: "{}",
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

    // 规则/LLM 评估（LLM 用用户自配的 API 配置，key 只在服务端）
    const apiConfig = await this.store.getApiConfig(ownerId);
    const llm = apiConfig?.enabled && apiConfig.apiKey
      ? { baseUrl: apiConfig.baseUrl, apiKey: apiConfig.apiKey, model: apiConfig.model }
      : undefined;
    const assessment = await this.agents.evidenceEvaluator.evaluateEvidence({
      evidenceId,
      nodeId: evidence.nodeId,
      nodeTitle: node.title,
      targetLevel: node.targetLevel,
      evidenceType: evidence.evidenceType,
      content: evidence.content,
      externalUrl: evidence.externalUrl,
      criteria: activity.evaluationCriteria,
      capabilitySignals: node.signals,
      isSkipValidation: activity.isSkipValidation,
    }, llm);

    // 证据状态迁移
    if (assessment.verdict === "accepted") {
      evidence.status = transitionEvidence(evidence.status, { type: "accept" });
      activity.status = transitionActivity(activity.status, { type: "reviewAccepted" });
    } else {
      evidence.status = transitionEvidence(evidence.status, { type: "requestRevision" });
      activity.status = transitionActivity(activity.status, { type: "reviewNeedsRevision" });
      // 复测失败：节点降级回 growing + 熟练等级 -1（能力被证明不足）
      if (activity.activityType === "retest") {
        const progress = await this.getOrCreateNodeProgress(ownerId, evidence.nodeId);
        progress.status = transitionNode(progress.status, { type: "evidenceInvalidated" });
        progress.confidence = Math.max(0, progress.confidence - 1);
        progress.reviewCount += 1;
        await this.store.saveNodeProgress(progress);
      }
    }
    evidence.feedback = assessment.rationale || assessment.reasons.join("；") || assessment.missing.join("；");
    evidence.extractedJson = JSON.stringify(assessment.evidenceCard);
    evidence.reviewJson = JSON.stringify(assessment);
    await this.store.saveEvidence(evidence);
    await this.store.saveActivity(activity);

    // 节点状态：证据 accepted 后驱动节点迁移
    // 综合任务/复测驱动的首次验证需用户确认（pending_confirmation）；
    // 复测通过（节点已 validated）不重复确认，直接顺延下次复测
    const progress = await this.getOrCreateNodeProgress(ownerId, evidence.nodeId);
    // 综合任务 = 最终裁决，永远需用户确认（即便节点已 validated 再次验证）；
    // 复测 = 复核机制，仅首次验证需确认（通过后直接顺延）
    const requiresConfirmation =
      activity.activityType === "integrated_task" ||
      (activity.activityType === "retest" && progress.status !== "validated");
    if (assessment.verdict === "accepted") {
      const nodeEvent = nodeEventOfEvidence(evidence.status, { requiresConfirmation });
      // 需确认的活动（综合任务）无条件迁移（含 validated → pending 再确认）；
      // 免确认活动在 validated 节点上跳过迁移（复测通过保持状态只顺延）
      if (nodeEvent && (requiresConfirmation || progress.status !== "validated")) {
        progress.status = transitionNode(progress.status, nodeEvent);
        progress.confidence = Math.max(progress.confidence, assessment.suggestedLevel);
        progress.lastValidatedAt =
          progress.status === "validated" ? new Date().toISOString() : progress.lastValidatedAt;
        progress.supportingEvidenceIds = [
          ...new Set([...progress.supportingEvidenceIds, evidenceId]),
        ];
      }
      // 复测通过：顺延下次复测（间隔翻倍，上限 56 天）
      if (activity.activityType === "retest" && progress.status === "validated") {
        progress.reviewCount += 1;
        const interval = Math.min(progress.reviewIntervalDays * 2, 56);
        progress.reviewIntervalDays = interval;
        progress.nextReviewAt = new Date(Date.now() + interval * 86400000).toISOString();
      }
      // 掌握确认时间由 confirm-mastery 接口写入（reviewEvidence 只迁移状态）
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

  // ── GET /api/learning/resources/inbox ─────────────────
  // 收集箱独立于学习状态（无 profile 也能读），不走 getWorkspace（profile null 会早退）。
  async listInboxResources(ownerId: string): Promise<UserResource[]> {
    return this.store.listUserResources(ownerId);
  }

  // ── POST /api/learning/nodes/:id/confirm-mastery ──────
  // 掌握确认：pending_confirmation 节点 → 确认(validated) / 纠正(growing + 降级 + 补强建议)
  async confirmMastery(
    ownerId: string,
    nodeId: string,
    input: { decision: "confirmed" | "corrected"; note?: string },
  ): Promise<Workspace> {
    const progress = await this.getOrCreateNodeProgress(ownerId, nodeId);
    if (progress.status !== "pending_confirmation") {
      throw new LearningError(`节点状态 ${progress.status} 不需要掌握确认`, 400);
    }
    const node = learningContentPack.nodes.find((n) => n.id === nodeId);
    const profile = await this.store.getProfile(ownerId);
    if (!profile) throw new LearningError("尚未完成诊断", 404);

    if (input.decision === "confirmed") {
      progress.status = transitionNode(progress.status, { type: "confirmMastery" });
      progress.lastValidatedAt = new Date().toISOString();
      progress.confirmedAt = new Date().toISOString();
      const adjustment: AdjustmentRecord = {
        id: stableId("adjustment", `${ownerId}:${nodeId}:mastery-confirm:${Date.now()}`),
        ownerId,
        routeId: profile.activeRouteId,
        weeklyPlanId: null,
        adjustmentType: "mastery_confirm",
        reason: "用户确认掌握",
        status: "accepted",
        summary: `用户确认掌握「${node?.title ?? nodeId}」，节点进入已验证。`,
      };
      await this.store.saveAdjustment(adjustment);
    } else {
      // 纠正：回 growing + 降级 + 补强建议
      progress.status = transitionNode(progress.status, { type: "correctMastery" });
      progress.confidence = Math.max(0, progress.confidence - 1);
      progress.confirmedAt = null;
      const note = input.note?.trim() || "未说明原因";
      const confirmAdjustment: AdjustmentRecord = {
        id: stableId("adjustment", `${ownerId}:${nodeId}:mastery-correct:${Date.now()}`),
        ownerId,
        routeId: profile.activeRouteId,
        weeklyPlanId: null,
        adjustmentType: "mastery_confirm",
        reason: `用户纠正掌握判断：${note}`,
        status: "rejected",
        summary: `用户纠正「${node?.title ?? nodeId}」的掌握判断：${note}；熟练等级降 1，生成补强建议。`,
      };
      await this.store.saveAdjustment(confirmAdjustment);
      const boost: AdjustmentRecord = {
        id: stableId("adjustment", `${ownerId}:${nodeId}:boost:${Date.now()}`),
        ownerId,
        routeId: profile.activeRouteId,
        weeklyPlanId: null,
        adjustmentType: "weekly_light",
        reason: "掌握确认被纠正，需要补强",
        status: "proposed",
        summary: `为「${node?.title ?? nodeId}」安排复习/补强活动，重新积累证据后再次验证。`,
      };
      await this.store.saveAdjustment(boost);
    }
    await this.store.saveNodeProgress(progress);
    return this.getWorkspace(ownerId);
  }

  // ── POST /api/learning/nodes/:id/retest ──────────────
  // 延迟复测：为到期节点生成 retest 活动（走现有活动闭环）
  async retestNode(ownerId: string, nodeId: string): Promise<Workspace> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) throw new LearningError("尚未完成诊断", 404);
    const progress = await this.getOrCreateNodeProgress(ownerId, nodeId);
    if (progress.status !== "validated") {
      throw new LearningError(`节点状态 ${progress.status} 不是已验证，无需复测`, 400);
    }
    const node = learningContentPack.nodes.find((n) => n.id === nodeId);
    if (!node) throw new LearningError("节点不存在", 404);

    const weekKey = currentWeekKey();
    let plan = await this.store.getWeeklyPlanByWeek(ownerId, profile.activeRouteId, weekKey);
    if (!plan) {
      // 本周无计划则创建（retest 独立于周计划编排）
      plan = {
        id: stableId("plan", `${ownerId}:${profile.activeRouteId}:${weekKey}`),
        ownerId,
        routeId: profile.activeRouteId,
        weekKey,
        capacityMinutes: profile.weeklyMinutes,
        status: "confirmed",
        rationale: "为延迟复测创建的本周计划。",
      };
      await this.store.saveWeeklyPlan(plan);
    }
    const draft: ActivityDraft = this.agents.activityComposer.composeActivity({
      nodeId,
      nodeTitle: node.title,
      nodeDescription: node.description,
      activityType: "retest",
      isSkipValidation: false,
      resourceIds: [],
      estimatedMinutes: 45,
    });
    const existing = await this.store.listActivitiesByPlan(plan.id);
    const sequence = existing.length
      ? Math.max(...existing.map((a) => a.sequence)) + 1
      : 0;
    const activity: LearningActivity = {
      id: stableId("activity", `${plan.id}:${sequence}:${nodeId}:retest`),
      ownerId,
      weeklyPlanId: plan.id,
      nodeId,
      title: draft.title,
      activityType: "retest",
      goal: draft.goal,
      estimatedMinutes: draft.estimatedMinutes,
      isCore: false,
      status: "planned",
      isSkipValidation: false,
      inputRefs: [],
      steps: draft.steps.join("\n"),
      expectedEvidence: draft.expectedEvidence,
      evaluationCriteria: draft.evaluationCriteria,
      nextAdvice: draft.nextAdvice,
      sequence,
    };
    await this.store.saveActivity(activity);
    return this.getWorkspace(ownerId);
  }

  // ── POST /api/learning/resources/inbox ───────────────
  async saveUserResource(
    ownerId: string,
    input: { title: string; type: UserResource["type"]; content?: string; sourceUrl?: string },
  ): Promise<Workspace> {
    if (!input.title.trim()) throw new LearningError("标题不能为空", 400);
    const resource: UserResource = {
      id: stableId("uresource", `${ownerId}:${Date.now()}`),
      ownerId,
      title: input.title.trim(),
      type: input.type,
      content: input.content?.trim() ?? "",
      sourceUrl: input.sourceUrl?.trim() ?? "",
      relatedNodeIds: [],
      createdAt: new Date().toISOString(),
    };
    await this.store.saveUserResource(resource);
    return this.getWorkspace(ownerId);
  }

  // ── POST /api/learning/reset ─────────────────────────
  // 重新设置：清空该用户全部学习状态，回到未诊断起点（内容层不动）。
  async resetLearner(ownerId: string): Promise<Workspace> {
    await this.store.resetLearner(ownerId);
    return this.getWorkspace(ownerId);
  }

  // ── LLM API 配置 ────────────────────────────────────
  // 保存用户自配的 API（key 存服务端表）；读取时脱敏，绝不下发前端。
  async saveApiConfig(
    ownerId: string,
    input: { baseUrl: string; apiKey: string; model: string; enabled: boolean },
  ): Promise<{ configured: boolean; baseUrl: string; model: string; enabled: boolean; keyMasked: boolean }> {
    const existing = await this.store.getApiConfig(ownerId);
    const config = {
      id: existing?.id ?? stableId("apiconfig", ownerId),
      ownerId,
      baseUrl: input.baseUrl.trim(),
      // key 为空时保留旧值（允许只改 baseUrl/model 不改 key）
      apiKey: input.apiKey.trim() || existing?.apiKey || "",
      model: input.model.trim() || "deepseek-chat",
      enabled: input.enabled,
    };
    await this.store.saveApiConfig(config);
    return {
      configured: Boolean(config.apiKey),
      baseUrl: config.baseUrl,
      model: config.model,
      enabled: config.enabled,
      keyMasked: Boolean(config.apiKey),
    };
  }

  // 读取配置状态（key 脱敏）：前端只看到是否已配置 + 模型 + 地址
  async getApiConfigStatus(ownerId: string): Promise<{
    configured: boolean;
    enabled: boolean;
    baseUrl: string;
    model: string;
    keyMasked: boolean;
  }> {
    const config = await this.store.getApiConfig(ownerId);
    return {
      configured: Boolean(config?.apiKey),
      enabled: config?.enabled ?? false,
      baseUrl: config?.baseUrl ?? "",
      model: config?.model ?? "",
      keyMasked: Boolean(config?.apiKey),
    };
  }

  // ── POST /api/learning/adjustments/propose ─────────
  async proposeAdjustment(
    ownerId: string,
    input: { adjustmentType: AdjustmentType; reason: string },
  ): Promise<Workspace> {
    const profile = await this.store.getProfile(ownerId);
    if (!profile) throw new LearningError("尚未完成诊断", 404);
    if (profile.status !== "confirmed") throw new LearningError("路线尚未确认，不能调整", 400);

    const reason = input.reason.trim().slice(0, 600);
    if (!reason) throw new LearningError("调整理由不能为空", 400);

    const weeklyPlan = await this.store.getWeeklyPlanByWeek(
      ownerId,
      profile.activeRouteId,
      currentWeekKey(),
    );
    const summaryByType: Record<AdjustmentType, string> = {
      weekly_light: `用户提出本周容量/节奏微调：${reason}`,
      activity_replan: `用户提出重排学习活动：${reason}`,
      route_revision: `用户提出路线或分支调整：${reason}`,
      mastery_confirm: `用户对掌握判断提出纠正：${reason}`,
    };
    const adjustment: AdjustmentRecord = {
      id: stableId("adjustment", `${ownerId}:${Date.now()}:${input.adjustmentType}:${reason}`),
      ownerId,
      routeId: profile.activeRouteId,
      weeklyPlanId: weeklyPlan?.id ?? null,
      adjustmentType: input.adjustmentType,
      reason,
      status: "proposed",
      summary: summaryByType[input.adjustmentType],
    };
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
  private async createActivitiesFromPlanDraft(
    ownerId: string,
    weeklyPlan: WeeklyPlan,
    items: Array<{
      nodeId: string;
      activityType: LearningActivity["activityType"];
      title: string;
      estimatedMinutes: number;
      isCore: boolean;
      whyNow: string;
    }>,
    startSequence: number,
  ): Promise<void> {
    let sequence = startSequence;
    for (const item of items) {
      const node = learningContentPack.nodes.find((n) => n.id === item.nodeId)!;
      const resourceIds = learningContentPack.resourceMappings
        .filter((m) => m.nodeId === item.nodeId)
        .map((m) => m.resourceId);
      const draft: ActivityDraft = this.agents.activityComposer.composeActivity({
        nodeId: item.nodeId,
        nodeTitle: node.title, // 纯节点标题（composer 自行加类型前缀，避免双重前缀）
        nodeDescription: node.description,
        activityType: item.activityType,
        isSkipValidation: false,
        resourceIds,
        estimatedMinutes: item.estimatedMinutes,
      });
      const activity: LearningActivity = {
        id: stableId("activity", `${weeklyPlan.id}:${sequence}:${item.nodeId}:${item.activityType}:${item.title}`),
        ownerId,
        weeklyPlanId: weeklyPlan.id,
        nodeId: item.nodeId,
        title: draft.title,
        activityType: draft.activityType,
        goal: `${draft.goal} 原因：${item.whyNow}`,
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
  }

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
      confirmedAt: null,
      reviewIntervalDays: 14,
      nextReviewAt: null,
      reviewCount: 0,
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
