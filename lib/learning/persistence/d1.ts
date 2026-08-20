// V0.2 learning persistence — D1 实现（生产）
// 使用原生 D1 SQL（env.DB.prepare().bind().run()），绕开 drizzle-orm/d1
// 对 upsert 的序列化问题（其生成 "ON CONFLICT (\"table\".\"id\")" 表名限定符，
// SQLite 不接受，导致 miniflare D1 执行失败）。
// 接口与 LearningStore 一致，应用层零感知。

import type {
  AdjustmentRecord,
  Evidence,
  LearningActivity,
  NodeProgress,
  WeeklyPlan,
} from "../domain/types.ts";
import { learningContentPack } from "../domain/content.ts";
import type { ApiConfig, LearningStore, LearnerProfile } from "./store.ts";

// D1 实例类型：D1Database 全局类型依赖未安装的 @miniflare/d1，
// 这里用 any 桥接（仓库 pre-existing 问题，worker/index.ts 同样受影响）。
// 类型安全由 LearningStore 接口与应用层保证。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export class D1LearningStore implements LearningStore {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  // ── 内容层种子（幂等）──────────────────────────────
  // 学习地图内容包是版本化只读数据，存于代码；首次使用时写入 D1
  // 内容层表，保证状态层外键（active_route_id 等）有真实引用。
  async seedContent(): Promise<void> {
    const pack = learningContentPack;

    for (const route of pack.routes) {
      await this.db
        .prepare(
          "INSERT OR IGNORE INTO learning_routes (id, version, title, description) VALUES (?, ?, ?, ?)",
        )
        .bind(route.id, route.version, route.title, route.description)
        .run();
    }

    for (const node of pack.nodes) {
      await this.db
        .prepare(
          `INSERT OR IGNORE INTO learning_nodes
             (id, route_id, title, description, target_level, is_key_milestone)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(node.id, node.routeId, node.title, node.description, node.targetLevel, node.isKeyMilestone ? 1 : 0)
        .run();
    }

    for (const edge of pack.edges) {
      await this.db
        .prepare(
          `INSERT OR IGNORE INTO learning_edges (source_node_id, target_node_id, relation_type)
           VALUES (?, ?, ?)`,
        )
        .bind(edge.sourceNodeId, edge.targetNodeId, edge.relationType)
        .run();
    }

    for (const branch of pack.branches) {
      await this.db
        .prepare(
          `INSERT OR IGNORE INTO learning_branches (id, route_id, name, description, main_node_id)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(branch.id, branch.routeId, branch.name, branch.description, branch.mainNodeId)
        .run();
    }

    for (const resource of pack.resources) {
      await this.db
        .prepare(
          `INSERT OR IGNORE INTO learning_resources
             (id, title, url, source_type, credibility_level, summary)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          resource.id,
          resource.title,
          resource.url,
          resource.sourceType,
          resource.credibilityLevel,
          resource.summary,
        )
        .run();
    }

    for (const mapping of pack.resourceMappings) {
      await this.db
        .prepare(
          `INSERT OR IGNORE INTO learning_resource_mappings (resource_id, node_id, usage)
           VALUES (?, ?, ?)`,
        )
        .bind(mapping.resourceId, mapping.nodeId, mapping.usage)
        .run();
    }

    for (const tool of pack.tools) {
      await this.db
        .prepare(
          `INSERT OR IGNORE INTO learning_tools (id, name, url, description)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(tool.id, tool.name, tool.url, tool.description)
        .run();
    }

    for (const mapping of pack.toolMappings) {
      await this.db
        .prepare(
          `INSERT OR IGNORE INTO learning_tool_mappings (tool_id, node_id, usage, activity_context)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(mapping.toolId, mapping.nodeId, mapping.usage, mapping.activityContext)
        .run();
    }
  }

  // ── 学习者画像 ──────────────────────────────────────
  async getProfile(ownerId: string): Promise<LearnerProfile | null> {
    const row = await this.db
      .prepare("SELECT * FROM learning_profiles WHERE owner_id = ? LIMIT 1")
      .bind(ownerId)
      .first();
    return row
      ? {
          id: row.id,
          ownerId: row.owner_id,
          goal: row.goal,
          activeRouteId: row.active_route_id,
          weeklyMinutes: row.weekly_minutes,
          status: row.status,
        }
      : null;
  }

  async saveProfile(profile: LearnerProfile): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO learning_profiles
           (id, owner_id, goal, active_route_id, weekly_minutes, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
         ON CONFLICT (id) DO UPDATE SET
           goal = excluded.goal,
           active_route_id = excluded.active_route_id,
           weekly_minutes = excluded.weekly_minutes,
           status = excluded.status,
           updated_at = excluded.updated_at`,
      )
      .bind(
        profile.id,
        profile.ownerId,
        profile.goal,
        profile.activeRouteId,
        profile.weeklyMinutes,
        profile.status,
        now,
      )
      .run();
  }

  // ── LLM API 配置 ────────────────────────────────────
  async getApiConfig(ownerId: string): Promise<ApiConfig | null> {
    const row = await this.db
      .prepare("SELECT * FROM learning_api_config WHERE owner_id = ? LIMIT 1")
      .bind(ownerId)
      .first();
    return row
      ? {
          id: row.id,
          ownerId: row.owner_id,
          baseUrl: row.base_url,
          apiKey: row.api_key,
          model: row.model,
          enabled: Boolean(row.enabled),
        }
      : null;
  }

  async saveApiConfig(config: ApiConfig): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO learning_api_config
           (id, owner_id, base_url, api_key, model, enabled, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           base_url = excluded.base_url,
           api_key = excluded.api_key,
           model = excluded.model,
           enabled = excluded.enabled,
           updated_at = excluded.updated_at`,
      )
      .bind(
        config.id,
        config.ownerId,
        config.baseUrl,
        config.apiKey,
        config.model,
        config.enabled ? 1 : 0,
        now,
      )
      .run();
  }

  // ── 周计划 ────────────────────────────────────────
  async getWeeklyPlanByWeek(ownerId: string, routeId: string, weekKey: string): Promise<WeeklyPlan | null> {
    const row = await this.db
      .prepare(
        "SELECT * FROM learning_weekly_plans WHERE owner_id = ? AND route_id = ? AND week_key = ? LIMIT 1",
      )
      .bind(ownerId, routeId, weekKey)
      .first();
    return row
      ? {
          id: row.id,
          ownerId: row.owner_id,
          routeId: row.route_id,
          weekKey: row.week_key,
          capacityMinutes: row.capacity_minutes,
          status: row.status,
          rationale: row.rationale,
        }
      : null;
  }

  async saveWeeklyPlan(plan: WeeklyPlan): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO learning_weekly_plans
           (id, owner_id, route_id, week_key, capacity_minutes, status, rationale, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
         ON CONFLICT (id) DO UPDATE SET
           capacity_minutes = excluded.capacity_minutes,
           status = excluded.status,
           rationale = excluded.rationale,
           updated_at = excluded.updated_at`,
      )
      .bind(
        plan.id,
        plan.ownerId,
        plan.routeId,
        plan.weekKey,
        plan.capacityMinutes,
        plan.status,
        plan.rationale,
        now,
      )
      .run();
  }

  // ── 活动 ──────────────────────────────────────────
  async listActivitiesByPlan(planId: string): Promise<LearningActivity[]> {
    const rows = await this.db
      .prepare("SELECT * FROM learning_activities WHERE weekly_plan_id = ? ORDER BY sequence ASC")
      .bind(planId)
      .all();
    return (rows.results ?? []).map(activityFromRow);
  }

  async getActivity(activityId: string): Promise<LearningActivity | null> {
    const row = await this.db
      .prepare("SELECT * FROM learning_activities WHERE id = ? LIMIT 1")
      .bind(activityId)
      .first();
    return row ? activityFromRow(row) : null;
  }

  async saveActivity(activity: LearningActivity): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO learning_activities
           (id, owner_id, weekly_plan_id, node_id, title, activity_type, goal,
            estimated_minutes, is_core, status, is_skip_validation, input_refs,
            steps, expected_evidence, evaluation_criteria, next_advice, sequence,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
         ON CONFLICT (id) DO UPDATE SET
           status = excluded.status,
           next_advice = excluded.next_advice,
           updated_at = excluded.updated_at`,
      )
      .bind(
        activity.id,
        activity.ownerId,
        activity.weeklyPlanId,
        activity.nodeId,
        activity.title,
        activity.activityType,
        activity.goal,
        activity.estimatedMinutes,
        activity.isCore ? 1 : 0,
        activity.status,
        activity.isSkipValidation ? 1 : 0,
        activity.inputRefs.join(","),
        activity.steps,
        activity.expectedEvidence,
        activity.evaluationCriteria,
        activity.nextAdvice,
        activity.sequence,
        now,
      )
      .run();
  }

  async clearOpenActivitiesForPlan(ownerId: string, planId: string): Promise<void> {
    await this.db
      .prepare(
        `DELETE FROM learning_activities
         WHERE owner_id = ?
           AND weekly_plan_id = ?
           AND status IN ('planned', 'in_progress')
           AND id NOT IN (
             SELECT activity_id FROM learning_evidence WHERE owner_id = ?
           )`,
      )
      .bind(ownerId, planId, ownerId)
      .run();
  }

  // ── 证据 ──────────────────────────────────────────
  async listEvidenceByActivity(activityId: string): Promise<Evidence[]> {
    const rows = await this.db
      .prepare("SELECT * FROM learning_evidence WHERE activity_id = ?")
      .bind(activityId)
      .all();
    return (rows.results ?? []).map(evidenceFromRow);
  }

  async listEvidenceByNode(nodeId: string): Promise<Evidence[]> {
    const rows = await this.db
      .prepare("SELECT * FROM learning_evidence WHERE node_id = ?")
      .bind(nodeId)
      .all();
    return (rows.results ?? []).map(evidenceFromRow);
  }

  async getEvidence(evidenceId: string): Promise<Evidence | null> {
    const row = await this.db
      .prepare("SELECT * FROM learning_evidence WHERE id = ? LIMIT 1")
      .bind(evidenceId)
      .first();
    return row ? evidenceFromRow(row) : null;
  }

  async saveEvidence(evidence: Evidence): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO learning_evidence
           (id, owner_id, activity_id, node_id, evidence_type, content, external_url,
            status, feedback, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
         ON CONFLICT (id) DO UPDATE SET
           content = excluded.content,
           external_url = excluded.external_url,
           status = excluded.status,
           feedback = excluded.feedback,
           updated_at = excluded.updated_at`,
      )
      .bind(
        evidence.id,
        evidence.ownerId,
        evidence.activityId,
        evidence.nodeId,
        evidence.evidenceType,
        evidence.content,
        evidence.externalUrl,
        evidence.status,
        evidence.feedback,
        now,
      )
      .run();
  }

  // ── 节点进度 ──────────────────────────────────────
  async getNodeProgress(ownerId: string, nodeId: string): Promise<NodeProgress | null> {
    const row = await this.db
      .prepare("SELECT * FROM learning_node_progress WHERE owner_id = ? AND node_id = ? LIMIT 1")
      .bind(ownerId, nodeId)
      .first();
    return row ? nodeProgressFromRow(row) : null;
  }

  async listNodeProgress(ownerId: string): Promise<NodeProgress[]> {
    const rows = await this.db
      .prepare("SELECT * FROM learning_node_progress WHERE owner_id = ?")
      .bind(ownerId)
      .all();
    return (rows.results ?? []).map(nodeProgressFromRow);
  }

  async saveNodeProgress(progress: NodeProgress): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO learning_node_progress
           (id, owner_id, node_id, status, confidence, last_validated_at,
            supporting_evidence_ids, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           status = excluded.status,
           confidence = excluded.confidence,
           last_validated_at = excluded.last_validated_at,
           supporting_evidence_ids = excluded.supporting_evidence_ids,
           updated_at = excluded.updated_at`,
      )
      .bind(
        progress.id,
        progress.ownerId,
        progress.nodeId,
        progress.status,
        progress.confidence,
        progress.lastValidatedAt,
        progress.supportingEvidenceIds.join(","),
        now,
      )
      .run();
  }

  // ── 调整记录 ──────────────────────────────────────
  async listAdjustments(ownerId: string): Promise<AdjustmentRecord[]> {
    const rows = await this.db
      .prepare("SELECT * FROM learning_adjustments WHERE owner_id = ? ORDER BY updated_at DESC")
      .bind(ownerId)
      .all();
    return (rows.results ?? []).map(adjustmentFromRow);
  }

  async getAdjustment(adjustmentId: string): Promise<AdjustmentRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM learning_adjustments WHERE id = ? LIMIT 1")
      .bind(adjustmentId)
      .first();
    return row ? adjustmentFromRow(row) : null;
  }

  async saveAdjustment(adjustment: AdjustmentRecord): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO learning_adjustments
           (id, owner_id, route_id, weekly_plan_id, adjustment_type, reason, status,
            summary, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
         ON CONFLICT (id) DO UPDATE SET
           status = excluded.status,
           summary = excluded.summary,
           updated_at = excluded.updated_at`,
      )
      .bind(
        adjustment.id,
        adjustment.ownerId,
        adjustment.routeId,
        adjustment.weeklyPlanId,
        adjustment.adjustmentType,
        adjustment.reason,
        adjustment.status,
        adjustment.summary,
        now,
      )
      .run();
  }

  // 重置：清空该用户全部学习状态（重新诊断用），内容层不动；
  // 删除顺序先子后父（证据/调整引用活动，活动引用周计划/节点，周计划引用画像）
  async resetLearner(ownerId: string): Promise<void> {
    await this.db.batch([
      this.db.prepare("DELETE FROM learning_evidence WHERE owner_id = ?").bind(ownerId),
      this.db.prepare("DELETE FROM learning_adjustments WHERE owner_id = ?").bind(ownerId),
      this.db.prepare("DELETE FROM learning_activities WHERE owner_id = ?").bind(ownerId),
      this.db.prepare("DELETE FROM learning_node_progress WHERE owner_id = ?").bind(ownerId),
      this.db.prepare("DELETE FROM learning_weekly_plans WHERE owner_id = ?").bind(ownerId),
      this.db.prepare("DELETE FROM learning_profiles WHERE owner_id = ?").bind(ownerId),
    ]);
  }
}

// ── 行映射辅助 ──────────────────────────────────────
function activityFromRow(row: Record<string, unknown>): LearningActivity {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    weeklyPlanId: String(row.weekly_plan_id),
    nodeId: String(row.node_id),
    title: String(row.title),
    activityType: row.activity_type as LearningActivity["activityType"],
    goal: String(row.goal),
    estimatedMinutes: Number(row.estimated_minutes),
    isCore: Boolean(row.is_core),
    status: row.status as LearningActivity["status"],
    isSkipValidation: Boolean(row.is_skip_validation),
    inputRefs: row.input_refs ? String(row.input_refs).split(",").filter(Boolean) : [],
    steps: String(row.steps),
    expectedEvidence: String(row.expected_evidence),
    evaluationCriteria: String(row.evaluation_criteria),
    nextAdvice: String(row.next_advice),
    sequence: Number(row.sequence),
  };
}

function evidenceFromRow(row: Record<string, unknown>): Evidence {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    activityId: String(row.activity_id),
    nodeId: String(row.node_id),
    evidenceType: row.evidence_type as Evidence["evidenceType"],
    content: String(row.content),
    externalUrl: String(row.external_url ?? ""),
    status: row.status as Evidence["status"],
    feedback: String(row.feedback ?? ""),
  };
}

function nodeProgressFromRow(row: Record<string, unknown>): NodeProgress {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    nodeId: String(row.node_id),
    status: row.status as NodeProgress["status"],
    confidence: Number(row.confidence),
    lastValidatedAt: row.last_validated_at ? String(row.last_validated_at) : null,
    supportingEvidenceIds: row.supporting_evidence_ids
      ? String(row.supporting_evidence_ids).split(",").filter(Boolean)
      : [],
  };
}

function adjustmentFromRow(row: Record<string, unknown>): AdjustmentRecord {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    routeId: String(row.route_id),
    weeklyPlanId: row.weekly_plan_id ? String(row.weekly_plan_id) : null,
    adjustmentType: row.adjustment_type as AdjustmentRecord["adjustmentType"],
    reason: String(row.reason),
    status: row.status as AdjustmentRecord["status"],
    summary: String(row.summary),
  };
}
