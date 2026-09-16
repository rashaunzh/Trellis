// V0.2 learning persistence — 内存实现（测试用）
// 模拟 LearningStore，便于应用层测试与 API 场景测试。

import type {
  UserResource,
  AdjustmentRecord,
  Evidence,
  LearningActivity,
  NodeProgress,
  WeeklyPlan,
} from "../domain/types.ts";
import type { LearningStore, LearnerProfile, DiagnosticSnapshot, WeekReviewRecord } from "./store.ts";

export class InMemoryLearningStore implements LearningStore {
  private profiles = new Map<string, LearnerProfile>();
  private diagnostics = new Map<string, DiagnosticSnapshot>();
  private weeklyPlans = new Map<string, WeeklyPlan>();
  private weekReviews = new Map<string, WeekReviewRecord>();
  private activities = new Map<string, LearningActivity>();
  private evidence = new Map<string, Evidence>();
  private nodeProgress = new Map<string, NodeProgress>();
  private adjustments = new Map<string, AdjustmentRecord>();
  private userResources = new Map<string, UserResource>();

  async activateCurriculumRuntime(input: {
    curriculumId: string;
    ownerId: string;
    profile: LearnerProfile;
    weeklyPlan: WeeklyPlan;
    activities: LearningActivity[];
    nodeProgress: NodeProgress[];
  }): Promise<void> {
    await this.saveProfile(input.profile);
    await this.saveWeeklyPlan(input.weeklyPlan);
    await this.clearOpenActivitiesForPlan(input.ownerId, input.weeklyPlan.id);
    for (const activity of input.activities) await this.saveActivity(activity);
    for (const progress of input.nodeProgress) await this.saveNodeProgress(progress);
  }

  async getProfile(ownerId: string): Promise<LearnerProfile | null> {
    for (const p of Array.from(this.profiles.values())) {
      if (p.ownerId === ownerId) return p;
    }
    return null;
  }

  async saveProfile(profile: LearnerProfile): Promise<void> {
    this.profiles.set(profile.id, { ...profile });
  }

  async getDiagnostic(ownerId: string): Promise<DiagnosticSnapshot | null> {
    for (const d of Array.from(this.diagnostics.values())) {
      if (d.ownerId === ownerId) return { ...d };
    }
    return null;
  }

  async saveDiagnostic(snapshot: DiagnosticSnapshot): Promise<void> {
    this.diagnostics.set(snapshot.id, { ...snapshot });
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

  async listWeeklyPlans(ownerId: string, routeId: string): Promise<WeeklyPlan[]> {
    return Array.from(this.weeklyPlans.values())
      .filter((plan) => plan.ownerId === ownerId && plan.routeId === routeId)
      .sort((a, b) => a.weekKey.localeCompare(b.weekKey));
  }

  async getWeekReview(ownerId: string, routeId: string, weekKey: string): Promise<WeekReviewRecord | null> {
    for (const review of this.weekReviews.values()) {
      if (review.ownerId === ownerId && review.routeId === routeId && review.weekKey === weekKey) {
        return { ...review };
      }
    }
    return null;
  }

  async saveWeekReview(review: WeekReviewRecord): Promise<void> {
    this.weekReviews.set(review.id, { ...review });
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

  async clearOpenActivitiesForPlan(ownerId: string, planId: string): Promise<void> {
    const evidenceActivityIds = new Set(
      Array.from(this.evidence.values())
        .filter((e) => e.ownerId === ownerId)
        .map((e) => e.activityId),
    );
    for (const [key, activity] of this.activities) {
      const isOpen = activity.status === "planned" || activity.status === "in_progress" || activity.status === "paused";
      if (
        activity.ownerId === ownerId
        && activity.weeklyPlanId === planId
        && isOpen
        && !evidenceActivityIds.has(activity.id)
      ) {
        this.activities.delete(key);
      }
    }
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

    async listUserResources(ownerId: string): Promise<UserResource[]> {
    return Array.from(this.userResources.values())
      .filter((r) => r.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveUserResource(resource: UserResource): Promise<void> {
    this.userResources.set(resource.id, { ...resource });
  }

async resetLearner(ownerId: string): Promise<void> {
    for (const map of [this.profiles, this.diagnostics, this.weeklyPlans, this.weekReviews, this.activities, this.nodeProgress, this.evidence, this.adjustments]) {
      for (const [key, value] of map) {
        if (value.ownerId === ownerId) map.delete(key);
      }
    }
  }

}
