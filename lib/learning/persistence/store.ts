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

// 用户自配的 LLM API 配置（key 仅存服务端表）
export interface ApiConfig {
  id: string;
  ownerId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
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
  // LLM API 配置
  getApiConfig(ownerId: string): Promise<ApiConfig | null>;
  saveApiConfig(config: ApiConfig): Promise<void>;
  // 重置：清空该用户全部学习状态（重新诊断用），内容层不动
  resetLearner(ownerId: string): Promise<void>;
}
