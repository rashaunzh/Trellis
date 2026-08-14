// V0.2 learning persistence — D1 实现（生产）
// 使用 Drizzle 映射到 db/schema.ts 中的 learning 域表。

import { and, eq } from "drizzle-orm";

import {
  learningActivities,
  learningAdjustments,
  learningEvidence,
  learningNodeProgress,
  learningProfiles,
  learningWeeklyPlans,
} from "../../../db/schema.ts";
import type {
  AdjustmentRecord,
  Evidence,
  LearningActivity,
  NodeProgress,
  WeeklyPlan,
} from "../domain/types.ts";
import type { LearningStore, LearnerProfile } from "./store.ts";

// D1 实例类型：drizzle/d1 的类型声明依赖未安装的 @miniflare/d1，
// 这里用 any 桥接（仓库 pre-existing 问题，worker/index.ts 同样受影响）。
// 类型安全由 LearningStore 接口与应用层保证。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export class D1LearningStore implements LearningStore {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  // ── 学习者画像 ──────────────────────────────────────
  async getProfile(ownerId: string): Promise<LearnerProfile | null> {
    const rows = await this.db
      .select()
      .from(learningProfiles)
      .where(eq(learningProfiles.ownerId, ownerId))
      .limit(1);
    const row = rows[0];
    return row
      ? {
          id: row.id,
          ownerId: row.ownerId,
          goal: row.goal,
          activeRouteId: row.activeRouteId,
          weeklyMinutes: row.weeklyMinutes,
          status: row.status,
        }
      : null;
  }

  async saveProfile(profile: LearnerProfile): Promise<void> {
    await this.db
      .insert(learningProfiles)
      .values({
        id: profile.id,
        ownerId: profile.ownerId,
        goal: profile.goal,
        activeRouteId: profile.activeRouteId,
        weeklyMinutes: profile.weeklyMinutes,
        status: profile.status,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: learningProfiles.id,
        set: {
          goal: profile.goal,
          activeRouteId: profile.activeRouteId,
          weeklyMinutes: profile.weeklyMinutes,
          status: profile.status,
          updatedAt: new Date().toISOString(),
        },
      });
  }

  // ── 周计划 ────────────────────────────────────────
  async getWeeklyPlanByWeek(ownerId: string, routeId: string, weekKey: string): Promise<WeeklyPlan | null> {
    const rows = await this.db
      .select()
      .from(learningWeeklyPlans)
      .where(and(
        eq(learningWeeklyPlans.ownerId, ownerId),
        eq(learningWeeklyPlans.routeId, routeId),
        eq(learningWeeklyPlans.weekKey, weekKey),
      ))
      .limit(1);
    const row = rows[0];
    return row
      ? {
          id: row.id,
          ownerId: row.ownerId,
          routeId: row.routeId,
          weekKey: row.weekKey,
          capacityMinutes: row.capacityMinutes,
          status: row.status,
          rationale: row.rationale,
        }
      : null;
  }

  async saveWeeklyPlan(plan: WeeklyPlan): Promise<void> {
    await this.db
      .insert(learningWeeklyPlans)
      .values({
        id: plan.id,
        ownerId: plan.ownerId,
        routeId: plan.routeId,
        weekKey: plan.weekKey,
        capacityMinutes: plan.capacityMinutes,
        status: plan.status,
        rationale: plan.rationale,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: learningWeeklyPlans.id,
        set: {
          capacityMinutes: plan.capacityMinutes,
          status: plan.status,
          rationale: plan.rationale,
          updatedAt: new Date().toISOString(),
        },
      });
  }

  // ── 活动 ──────────────────────────────────────────
  async listActivitiesByPlan(planId: string): Promise<LearningActivity[]> {
    const rows = await this.db
      .select()
      .from(learningActivities)
      .where(eq(learningActivities.weeklyPlanId, planId))
      .orderBy(learningActivities.sequence);
    return rows.map(activityFromRow);
  }

  async getActivity(activityId: string): Promise<LearningActivity | null> {
    const rows = await this.db
      .select()
      .from(learningActivities)
      .where(eq(learningActivities.id, activityId))
      .limit(1);
    return rows[0] ? activityFromRow(rows[0]) : null;
  }

  async saveActivity(activity: LearningActivity): Promise<void> {
    await this.db
      .insert(learningActivities)
      .values({
        id: activity.id,
        ownerId: activity.ownerId,
        weeklyPlanId: activity.weeklyPlanId,
        nodeId: activity.nodeId,
        title: activity.title,
        activityType: activity.activityType,
        goal: activity.goal,
        estimatedMinutes: activity.estimatedMinutes,
        isCore: activity.isCore,
        status: activity.status,
        isSkipValidation: activity.isSkipValidation,
        inputRefs: activity.inputRefs.join(","),
        steps: activity.steps,
        expectedEvidence: activity.expectedEvidence,
        evaluationCriteria: activity.evaluationCriteria,
        nextAdvice: activity.nextAdvice,
        sequence: activity.sequence,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: learningActivities.id,
        set: {
          status: activity.status,
          nextAdvice: activity.nextAdvice,
          updatedAt: new Date().toISOString(),
        },
      });
  }

  // ── 证据 ──────────────────────────────────────────
  async listEvidenceByActivity(activityId: string): Promise<Evidence[]> {
    const rows = await this.db
      .select()
      .from(learningEvidence)
      .where(eq(learningEvidence.activityId, activityId));
    return rows.map(evidenceFromRow);
  }

  async listEvidenceByNode(nodeId: string): Promise<Evidence[]> {
    const rows = await this.db
      .select()
      .from(learningEvidence)
      .where(eq(learningEvidence.nodeId, nodeId));
    return rows.map(evidenceFromRow);
  }

  async getEvidence(evidenceId: string): Promise<Evidence | null> {
    const rows = await this.db
      .select()
      .from(learningEvidence)
      .where(eq(learningEvidence.id, evidenceId))
      .limit(1);
    return rows[0] ? evidenceFromRow(rows[0]) : null;
  }

  async saveEvidence(evidence: Evidence): Promise<void> {
    await this.db
      .insert(learningEvidence)
      .values({
        id: evidence.id,
        ownerId: evidence.ownerId,
        activityId: evidence.activityId,
        nodeId: evidence.nodeId,
        evidenceType: evidence.evidenceType,
        content: evidence.content,
        externalUrl: evidence.externalUrl,
        status: evidence.status,
        feedback: evidence.feedback,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: learningEvidence.id,
        set: {
          content: evidence.content,
          externalUrl: evidence.externalUrl,
          status: evidence.status,
          feedback: evidence.feedback,
          updatedAt: new Date().toISOString(),
        },
      });
  }

  // ── 节点进度 ──────────────────────────────────────
  async getNodeProgress(ownerId: string, nodeId: string): Promise<NodeProgress | null> {
    const rows = await this.db
      .select()
      .from(learningNodeProgress)
      .where(and(
        eq(learningNodeProgress.ownerId, ownerId),
        eq(learningNodeProgress.nodeId, nodeId),
      ))
      .limit(1);
    const row = rows[0];
    return row
      ? {
          id: row.id,
          ownerId: row.ownerId,
          nodeId: row.nodeId,
          status: row.status,
          confidence: row.confidence,
          lastValidatedAt: row.lastValidatedAt,
          supportingEvidenceIds: row.supportingEvidenceIds
            ? row.supportingEvidenceIds.split(",").filter(Boolean)
            : [],
        }
      : null;
  }

  async listNodeProgress(ownerId: string): Promise<NodeProgress[]> {
    const rows = await this.db
      .select()
      .from(learningNodeProgress)
      .where(eq(learningNodeProgress.ownerId, ownerId));
    return rows.map((row) => ({
      id: row.id,
      ownerId: row.ownerId,
      nodeId: row.nodeId,
      status: row.status,
      confidence: row.confidence,
      lastValidatedAt: row.lastValidatedAt,
      supportingEvidenceIds: row.supportingEvidenceIds
        ? row.supportingEvidenceIds.split(",").filter(Boolean)
        : [],
    }));
  }

  async saveNodeProgress(progress: NodeProgress): Promise<void> {
    await this.db
      .insert(learningNodeProgress)
      .values({
        id: progress.id,
        ownerId: progress.ownerId,
        nodeId: progress.nodeId,
        status: progress.status,
        confidence: progress.confidence,
        lastValidatedAt: progress.lastValidatedAt,
        supportingEvidenceIds: progress.supportingEvidenceIds.join(","),
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: learningNodeProgress.id,
        set: {
          status: progress.status,
          confidence: progress.confidence,
          lastValidatedAt: progress.lastValidatedAt,
          supportingEvidenceIds: progress.supportingEvidenceIds.join(","),
          updatedAt: new Date().toISOString(),
        },
      });
  }

  // ── 调整记录 ──────────────────────────────────────
  async listAdjustments(ownerId: string): Promise<AdjustmentRecord[]> {
    const rows = await this.db
      .select()
      .from(learningAdjustments)
      .where(eq(learningAdjustments.ownerId, ownerId));
    return rows.map(adjustmentFromRow);
  }

  async getAdjustment(adjustmentId: string): Promise<AdjustmentRecord | null> {
    const rows = await this.db
      .select()
      .from(learningAdjustments)
      .where(eq(learningAdjustments.id, adjustmentId))
      .limit(1);
    return rows[0] ? adjustmentFromRow(rows[0]) : null;
  }

  async saveAdjustment(adjustment: AdjustmentRecord): Promise<void> {
    await this.db
      .insert(learningAdjustments)
      .values({
        id: adjustment.id,
        ownerId: adjustment.ownerId,
        routeId: adjustment.routeId,
        weeklyPlanId: adjustment.weeklyPlanId,
        adjustmentType: adjustment.adjustmentType,
        reason: adjustment.reason,
        status: adjustment.status,
        summary: adjustment.summary,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: learningAdjustments.id,
        set: {
          status: adjustment.status,
          summary: adjustment.summary,
          updatedAt: new Date().toISOString(),
        },
      });
  }
}

// ── 行映射辅助 ──────────────────────────────────────
function activityFromRow(row: {
  id: string;
  ownerId: string;
  weeklyPlanId: string;
  nodeId: string;
  title: string;
  activityType: LearningActivity["activityType"];
  goal: string;
  estimatedMinutes: number;
  isCore: boolean;
  status: LearningActivity["status"];
  isSkipValidation: boolean;
  inputRefs: string;
  steps: string;
  expectedEvidence: string;
  evaluationCriteria: string;
  nextAdvice: string;
  sequence: number;
}): LearningActivity {
  return {
    id: row.id,
    ownerId: row.ownerId,
    weeklyPlanId: row.weeklyPlanId,
    nodeId: row.nodeId,
    title: row.title,
    activityType: row.activityType,
    goal: row.goal,
    estimatedMinutes: row.estimatedMinutes,
    isCore: row.isCore,
    status: row.status,
    isSkipValidation: row.isSkipValidation,
    inputRefs: row.inputRefs ? row.inputRefs.split(",").filter(Boolean) : [],
    steps: row.steps,
    expectedEvidence: row.expectedEvidence,
    evaluationCriteria: row.evaluationCriteria,
    nextAdvice: row.nextAdvice,
    sequence: row.sequence,
  };
}

function evidenceFromRow(row: {
  id: string;
  ownerId: string;
  activityId: string;
  nodeId: string;
  evidenceType: Evidence["evidenceType"];
  content: string;
  externalUrl: string;
  status: Evidence["status"];
  feedback: string;
}): Evidence {
  return {
    id: row.id,
    ownerId: row.ownerId,
    activityId: row.activityId,
    nodeId: row.nodeId,
    evidenceType: row.evidenceType,
    content: row.content,
    externalUrl: row.externalUrl,
    status: row.status,
    feedback: row.feedback,
  };
}

function adjustmentFromRow(row: {
  id: string;
  ownerId: string;
  routeId: string;
  weeklyPlanId: string | null;
  adjustmentType: AdjustmentRecord["adjustmentType"];
  reason: string;
  status: AdjustmentRecord["status"];
  summary: string;
}): AdjustmentRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    routeId: row.routeId,
    weeklyPlanId: row.weeklyPlanId,
    adjustmentType: row.adjustmentType,
    reason: row.reason,
    status: row.status,
    summary: row.summary,
  };
}
