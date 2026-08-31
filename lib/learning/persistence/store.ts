// V0.2 learning persistence — 仓储接口
// 应用层只依赖此接口，不直接触碰 Drizzle/D1。
// 提供内存实现（测试）与 D1 实现（生产）。

import type {
  UserResource,
  AdjustmentRecord,
  Evidence,
  LearningActivity,
  NodeProgress,
  WeeklyPlan,
} from "../domain/types.ts";

export interface LearnerProfile {
  id: string;
  ownerId: string;
  goal: string;
  activeRouteId: string;
  weeklyMinutes: number;
  status: "diagnosed" | "proposed" | "confirmed";
}

// 诊断输入快照（Full Chain Phase 3）：复用 V0.1 遗留表 learning_diagnostics
// （无 schema 变更）。persist runDiagnostic 的原始输入（goal/weeklyMinutes/
// selfReport/materials/preference/plannerMode），使 confirmProposal 能按诊断时
// 的模式与输入重建 analysis / adaptivePlan（避免 preference/materials 丢失漂移）。
export interface DiagnosticSnapshot {
  id: string;
  ownerId: string;
  contentPackId: string;
  contentPackVersion: string;
  goal: string;
  weeklyMinutes: number;
  selfReportJson: string; // Record<string, number>（nodeId → 0-3）
  materialsJson: string; // string[]（materialIds）
  answersJson: string; // { plannerMode, preference }
  status: "submitted";
}

export interface WeekReviewRecord {
  id: string;
  ownerId: string;
  routeId: string;
  weekKey: string;
  summary: string;
  completedCount: number;
  acceptedEvidenceCount: number;
  revisionCount: number;
  openActivityCount: number;
  nextBestMove: string;
  reviewJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface LearningStore {
  // 学习者画像
  getProfile(ownerId: string): Promise<LearnerProfile | null>;
  saveProfile(profile: LearnerProfile): Promise<void>;
  // 诊断输入快照（learning_diagnostics，每 owner 每内容包版本一条）
  getDiagnostic(ownerId: string): Promise<DiagnosticSnapshot | null>;
  saveDiagnostic(snapshot: DiagnosticSnapshot): Promise<void>;
  // 周计划
  getWeeklyPlanByWeek(ownerId: string, routeId: string, weekKey: string): Promise<WeeklyPlan | null>;
  listWeeklyPlans(ownerId: string, routeId: string): Promise<WeeklyPlan[]>;
  saveWeeklyPlan(plan: WeeklyPlan): Promise<void>;
  // 周复盘归档
  getWeekReview(ownerId: string, routeId: string, weekKey: string): Promise<WeekReviewRecord | null>;
  saveWeekReview(review: WeekReviewRecord): Promise<void>;
  // 活动
  listActivitiesByPlan(planId: string): Promise<LearningActivity[]>;
  getActivity(activityId: string): Promise<LearningActivity | null>;
  saveActivity(activity: LearningActivity): Promise<void>;
  clearOpenActivitiesForPlan(ownerId: string, planId: string): Promise<void>;
  // 证据
  listEvidenceByActivity(activityId: string): Promise<Evidence[]>;
  listEvidenceByNode(nodeId: string): Promise<Evidence[]>;
  getEvidence(evidenceId: string): Promise<Evidence | null>;
  saveEvidence(evidence: Evidence): Promise<void>;
  // 节点进度
  getNodeProgress(ownerId: string, nodeId: string): Promise<NodeProgress | null>;
  listNodeProgress(ownerId: string): Promise<NodeProgress[]>;
  saveNodeProgress(progress: NodeProgress): Promise<void>;
  // 调整记录
  listAdjustments(ownerId: string): Promise<AdjustmentRecord[]>;
  getAdjustment(adjustmentId: string): Promise<AdjustmentRecord | null>;
  saveAdjustment(adjustment: AdjustmentRecord): Promise<void>;
  // 重置：清空该用户全部学习状态（重新诊断用），内容层不动
    // 工作台收集箱
  listUserResources(ownerId: string): Promise<UserResource[]>;
  saveUserResource(resource: UserResource): Promise<void>;
  resetLearner(ownerId: string): Promise<void>;
}
