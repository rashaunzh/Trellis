// V0.2 learning persistence — 仓储接口
// 应用层只依赖此接口，不直接触碰 Drizzle/D1。
// 提供内存实现（测试）与 D1 实现（生产）。

import type {
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

export interface LearningStore {
  // 学习者画像
  getProfile(ownerId: string): Promise<LearnerProfile | null>;
  saveProfile(profile: LearnerProfile): Promise<void>;
  // 周计划
  getWeeklyPlanByWeek(ownerId: string, routeId: string, weekKey: string): Promise<WeeklyPlan | null>;
  saveWeeklyPlan(plan: WeeklyPlan): Promise<void>;
  // 活动
  listActivitiesByPlan(planId: string): Promise<LearningActivity[]>;
  getActivity(activityId: string): Promise<LearningActivity | null>;
  saveActivity(activity: LearningActivity): Promise<void>;
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
}
