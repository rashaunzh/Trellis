// V0.2 learning domain — 状态机（纯函数，无副作用）
// 关键规则：
//  1. 活动完成（completed）不直接验证节点；节点只能由证据评估结果迁移
//  2. 证据 accepted 后才可能把节点置为 validated
//  3. 跳学生成验证活动（isSkipValidation），必须提交证据
//  4. 周计划刷新不重排（确定性编排见 agents/planner）

import type {
  ActivityStatus,
  EvidenceStatus,
  NodeStatus,
} from "./types.ts";

// ── 活动状态迁移 ──────────────────────────────────────
// planned → in_progress → evidence_submitted → reviewed → completed
//                      ↘ (证据被退回) → in_progress
export type ActivityEvent =
  | { type: "start" } // 开始活动
  | { type: "submitEvidence" } // 提交证据
  | { type: "reviewAccepted" } // 评估通过
  | { type: "reviewNeedsRevision" } // 评估退回
  | { type: "complete" }; // 活动完成（评估通过后）

const ACTIVITY_TRANSITIONS: Record<ActivityStatus, Partial<Record<ActivityEvent["type"], ActivityStatus>>> = {
  planned: { start: "in_progress" },
  in_progress: { submitEvidence: "evidence_submitted" },
  evidence_submitted: { reviewAccepted: "reviewed", reviewNeedsRevision: "in_progress" },
  reviewed: { complete: "completed" },
  completed: {},
};

export function transitionActivity(
  current: ActivityStatus,
  event: ActivityEvent,
): ActivityStatus {
  const next = ACTIVITY_TRANSITIONS[current]?.[event.type];
  if (!next) {
    throw new Error(
      `非法活动状态迁移: ${current} --${event.type}--> ?`,
    );
  }
  return next;
}

// ── 证据状态迁移 ──────────────────────────────────────
// draft → submitted → accepted
//                  ↘ needs_revision → (修订后重新) submitted
export type EvidenceEvent =
  | { type: "submit" }
  | { type: "accept" }
  | { type: "requestRevision" }
  | { type: "resubmit" };

const EVIDENCE_TRANSITIONS: Record<EvidenceStatus, Partial<Record<EvidenceEvent["type"], EvidenceStatus>>> = {
  draft: { submit: "submitted" },
  submitted: { accept: "accepted", requestRevision: "needs_revision" },
  needs_revision: { resubmit: "submitted" },
  accepted: {},
};

export function transitionEvidence(
  current: EvidenceStatus,
  event: EvidenceEvent,
): EvidenceStatus {
  const next = EVIDENCE_TRANSITIONS[current]?.[event.type];
  if (!next) {
    throw new Error(`非法证据状态迁移: ${current} --${event.type}--> ?`);
  }
  return next;
}

// ── 节点状态迁移 ──────────────────────────────────────
// unstarted → growing → validated
// 节点状态只允许两种方式进入 growing：
//   a) 用户开始/完成任意学习活动（产生候选证据）
//   b) 跳学（skip）→ 生成验证活动，进入待验证
// validated 只能由证据评估 accepted 驱动（见 evaluateNodeAfterEvidence）
export type NodeEvent =
  | { type: "beginLearning" } // 开始学习或产生候选证据
  | { type: "skipNode" } // 跳学：进入待验证
  | { type: "evidenceAccepted" } // 证据被接受（直接验证）
  | { type: "pendingConfirmation" } // 证据被接受但需用户确认（综合任务/复测驱动）
  | { type: "confirmMastery" } // 用户确认掌握 → validated
  | { type: "correctMastery" } // 用户纠正/否认 → 回 growing
  | { type: "evidenceInvalidated" }; // 新证据表明能力不足（降级）

const NODE_TRANSITIONS: Record<NodeStatus, Partial<Record<NodeEvent["type"], NodeStatus>>> = {
  unstarted: {
    beginLearning: "growing",
    skipNode: "growing",
    evidenceAccepted: "validated", // 强证据直接验证
  },
  growing: {
    beginLearning: "growing", // 继续学习，保持成长中
    evidenceAccepted: "validated",
    pendingConfirmation: "pending_confirmation", // 需用户确认的验证
    evidenceInvalidated: "growing", // 保持成长中，重新积累
  },
  pending_confirmation: {
    confirmMastery: "validated", // 用户确认掌握
    correctMastery: "growing", // 用户纠正/否认，重新积累
    evidenceInvalidated: "growing", // 新证据不足
  },
  validated: {
    pendingConfirmation: "pending_confirmation", // 综合任务等强证据需要再次确认
    evidenceInvalidated: "growing", // 允许新证据降级
  },
};

export function transitionNode(
  current: NodeStatus,
  event: NodeEvent,
): NodeStatus {
  const next = NODE_TRANSITIONS[current]?.[event.type];
  if (!next) {
    throw new Error(`非法节点状态迁移: ${current} --${event.type}--> ?`);
  }
  return next;
}

// ── 组合规则：活动事件如何影响节点 ─────────────────────
// 核心：活动状态和节点状态是两套独立状态机。
// 活动进入 evidence_submitted/reviewed/completed 都不会直接改变节点；
// 只有证据评估 accepted 才会驱动节点迁移。
export function nodeEffectOfActivityEvent(
  _activityStatus: ActivityStatus,
): NodeEvent | null {
  // 活动完成本身不产生节点事件；证据评估独立驱动节点
  return null;
}

// ── 组合规则：证据评估如何驱动节点 ─────────────────────
// 证据 accepted → 节点可以 validated（由调用方决定是否满足节点目标）
// 证据 needs_revision → 节点保持 growing
export function nodeEventOfEvidence(
  evidenceStatus: EvidenceStatus,
  opts: { requiresConfirmation?: boolean } = {},
): NodeEvent | null {
  if (evidenceStatus === "accepted") {
    // 综合任务/复测驱动的验证需用户确认（pending_confirmation），其余自动验证
    return opts.requiresConfirmation ? { type: "pendingConfirmation" } : { type: "evidenceAccepted" };
  }
  if (evidenceStatus === "needs_revision") return null; // 不降级，仅保持
  return null;
}

// ── 跳学规则 ──────────────────────────────────────────
// 跳学 = 不完成常规学习活动，直接要求证据验证。
// 返回：节点应进入 growing（待验证），并应生成 isSkipValidation 验证活动。
export interface SkipDecision {
  nodeStatus: NodeStatus; // 总是 "growing"
  requiresValidationActivity: boolean; // 总是 true
  reason: string;
}

export function decideSkip(
  currentNodeStatus: NodeStatus,
  hasPrerequisiteGap: boolean,
): SkipDecision {
  if (hasPrerequisiteGap) {
    throw new Error("前置未满足时不允许跳学，应先补前置活动");
  }
  if (currentNodeStatus === "validated") {
    throw new Error("节点已验证，无需跳学");
  }
  return {
    nodeStatus: "growing",
    requiresValidationActivity: true,
    reason: "跳学：跳过常规活动，节点进入待验证，必须通过证据验证",
  };
}
