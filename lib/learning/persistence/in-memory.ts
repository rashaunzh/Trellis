// V0.2 learning persistence — 内存实现（测试用）
// 模拟 LearningStore，便于应用层测试与 API 场景测试。

import type {
  AdjustmentRecord,
  Evidence,
  LearningActivity,
  NodeProgress,
  WeeklyPlan,
} from "../domain/types.ts";
import type { LearningStore, LearnerProfile } from "./store.ts";

export class InMemoryLearningStore implements LearningStore {
  private profiles = new Map<string, LearnerProfile>();
  private weeklyPlans = new Map<string, WeeklyPlan>();
  private activities = new Map<string, LearningActivity>();
  private evidence = new Map<string, Evidence>();
  private nodeProgress = new Map<string, NodeProgress>();
  private adjustments = new Map<string, AdjustmentRecord>();

  async getProfile(ownerId: string): Promise<LearnerProfile | null> {
    for (const p of Array.from(this.profiles.values())) {
      if (p.ownerId === ownerId) return p;
    }
    return null;
  }

  async saveProfile(profile: LearnerProfile): Promise<void> {
    this.profiles.set(profile.id, { ...profile });
  }

  async getWeeklyPlanByWeek(ownerId: string, routeId: string, weekKey: string): Promise<WeeklyPlan | null> {
    for (const plan of Array.from(this.weeklyPlans.values())) {
      if (plan.ownerId === ownerId && plan.routeId === routeId && plan.weekKey === weekKey) {
        return plan;
      }
    }
    return null;
  }

  async saveWeeklyPlan(plan: WeeklyPlan): Promise<void> {
    this.weeklyPlans.set(plan.id, { ...plan });
  }

  async listActivitiesByPlan(planId: string): Promise<LearningActivity[]> {
    return Array.from(this.activities.values())
      .filter((a) => a.weeklyPlanId === planId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  async getActivity(activityId: string): Promise<LearningActivity | null> {
    return this.activities.get(activityId) ?? null;
  }

  async saveActivity(activity: LearningActivity): Promise<void> {
    this.activities.set(activity.id, { ...activity });
  }

  async listEvidenceByActivity(activityId: string): Promise<Evidence[]> {
    return Array.from(this.evidence.values()).filter((e) => e.activityId === activityId);
  }

  async listEvidenceByNode(nodeId: string): Promise<Evidence[]> {
    return Array.from(this.evidence.values()).filter((e) => e.nodeId === nodeId);
  }

  async getEvidence(evidenceId: string): Promise<Evidence | null> {
    return this.evidence.get(evidenceId) ?? null;
  }

  async saveEvidence(evidence: Evidence): Promise<void> {
    this.evidence.set(evidence.id, { ...evidence });
  }

  async getNodeProgress(ownerId: string, nodeId: string): Promise<NodeProgress | null> {
    for (const p of Array.from(this.nodeProgress.values())) {
      if (p.ownerId === ownerId && p.nodeId === nodeId) return p;
    }
    return null;
  }

  async listNodeProgress(ownerId: string): Promise<NodeProgress[]> {
    return Array.from(this.nodeProgress.values()).filter((p) => p.ownerId === ownerId);
  }

  async saveNodeProgress(progress: NodeProgress): Promise<void> {
    this.nodeProgress.set(progress.id, { ...progress });
  }

  async listAdjustments(ownerId: string): Promise<AdjustmentRecord[]> {
    return Array.from(this.adjustments.values())
      .filter((a) => a.ownerId === ownerId)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async getAdjustment(adjustmentId: string): Promise<AdjustmentRecord | null> {
    return this.adjustments.get(adjustmentId) ?? null;
  }

  async saveAdjustment(adjustment: AdjustmentRecord): Promise<void> {
    this.adjustments.set(adjustment.id, { ...adjustment });
  }
}
