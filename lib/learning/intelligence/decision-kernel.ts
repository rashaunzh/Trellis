import { z } from "zod";

export const decisionTypeSchema = z.enum([
  "course_analysis",
  "curriculum_synthesis",
  "learning_adaptation",
  "source_evolution",
  "route_migration",
]);

export const decisionStatusSchema = z.enum([
  "generated",
  "proposed",
  "needs_review",
  "accepted",
  "rejected",
  "applied",
  "superseded",
  "failed",
]);

export const decisionRiskSchema = z.enum(["low", "high"]);

export const decisionRecordSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1).nullable(),
  decisionType: decisionTypeSchema,
  aggregateType: z.string().min(1),
  aggregateId: z.string().min(1),
  workflowRunId: z.string().min(1).nullable(),
  riskLevel: decisionRiskSchema,
  status: decisionStatusSchema,
  inputHash: z.string().min(1),
  proposal: z.record(z.string(), z.unknown()),
  rationale: z.record(z.string(), z.unknown()),
  citations: z.array(z.record(z.string(), z.unknown())),
  confidence: z.number().min(0).max(1),
  evalReport: z.record(z.string(), z.unknown()),
  modelRoute: z.record(z.string(), z.unknown()),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  appliedAt: z.string().min(1).nullable(),
});

export const decisionEventSchema = z.object({
  id: z.string().min(1),
  decisionId: z.string().min(1),
  fromStatus: decisionStatusSchema.nullable(),
  toStatus: decisionStatusSchema,
  actorType: z.enum(["system", "user", "admin", "workflow"]),
  actorOwnerId: z.string().min(1).nullable(),
  detail: z.record(z.string(), z.unknown()),
  createdAt: z.string().min(1),
});

export type DecisionRecord = z.infer<typeof decisionRecordSchema>;
export type DecisionEvent = z.infer<typeof decisionEventSchema>;
export type DecisionStatus = z.infer<typeof decisionStatusSchema>;
export type DecisionType = z.infer<typeof decisionTypeSchema>;

const transitions: Record<DecisionStatus, DecisionStatus[]> = {
  generated: ["proposed", "needs_review", "failed", "superseded"],
  proposed: ["accepted", "rejected", "superseded", "failed"],
  needs_review: ["accepted", "rejected", "superseded", "failed"],
  accepted: ["applied", "failed", "superseded"],
  rejected: [],
  applied: ["superseded"],
  superseded: [],
  failed: ["generated", "needs_review"],
};

export function transitionDecision(input: {
  decision: DecisionRecord;
  toStatus: DecisionStatus;
  actorType: DecisionEvent["actorType"];
  actorOwnerId?: string | null;
  detail?: Record<string, unknown>;
  now?: string;
}): { decision: DecisionRecord; event: DecisionEvent } {
  if (!transitions[input.decision.status].includes(input.toStatus)) {
    throw Object.assign(new Error(`决策不能从 ${input.decision.status} 进入 ${input.toStatus}`), { status: 409 });
  }
  const now = input.now ?? new Date().toISOString();
  const next: DecisionRecord = {
    ...input.decision,
    status: input.toStatus,
    updatedAt: now,
    appliedAt: input.toStatus === "applied" ? now : input.decision.appliedAt,
  };
  return {
    decision: next,
    event: {
      id: `decision-event.${crypto.randomUUID()}`,
      decisionId: next.id,
      fromStatus: input.decision.status,
      toStatus: input.toStatus,
      actorType: input.actorType,
      actorOwnerId: input.actorOwnerId ?? null,
      detail: input.detail ?? {},
      createdAt: now,
    },
  };
}

export interface LearningInterpretation {
  outcome: "advance" | "review" | "repair_prerequisite" | "change_material" | "reduce_scope" | "replan";
  confidence: number;
  rationale: string;
  keepsActivityOpen: boolean;
  riskLevel: "low" | "high";
}

export function interpretLearningSignal(input: {
  type: "understanding" | "quiz_result" | "stuck" | "judgment" | "scenario_choice" | "program_check" | "completion_report" | "time_constraint" | "quiz_report";
  value: string | number | boolean;
  note: string;
  context?: Record<string, unknown>;
  understanding?: "understood" | "uncertain" | "blocked";
}): LearningInterpretation {
  if (input.type === "program_check") return {
    outcome: "review", confidence: 0.5, keepsActivityOpen: true, riskLevel: "low",
    rationale: typeof input.context?.rationale === "string" ? input.context.rationale : "已保存补充检查；抽样题不能替代当前任务的全部完成标准。",
  };
  if (/换课程|切换主线|改路线|改变目标|暂缓分支|删除课程/.test(`${input.value} ${input.note}`)) {
    return { outcome: "replan", confidence: 0.8, rationale: "用户提出了会改变已确认路线的调整。", keepsActivityOpen: true, riskLevel: "high" };
  }
  if (input.understanding === "uncertain") return { outcome: "review", confidence: 0.8, rationale: "即使测验通过，用户仍报告不确定，先保留任务并回看。", keepsActivityOpen: true, riskLevel: "low" };
  if (input.understanding === "blocked") return interpretLearningSignal({ type: "stuck", value: input.value, note: input.note });
  if (input.type === "completion_report") return { outcome: "advance", confidence: 0.5, rationale: "已记录完成，但未验证理解或应用能力。可继续下一项，之后用独立检查补充证据。", keepsActivityOpen: false, riskLevel: "low" };
  if (input.type === "time_constraint") return { outcome: "review", confidence: 0.5, rationale: "已记录时间不足，任务保持未完成，原预计用时和范围不变。可在路线输入中修改每周投入，再审阅新方案。", keepsActivityOpen: true, riskLevel: "low" };
  if (input.type === "quiz_report") return { outcome: input.value === "passed" ? "advance" : "review", confidence: 0.5, rationale: input.value === "passed" ? "已记录你自报的课程测验通过；没有读取原始答案或成绩，未独立验证能力。" : "已记录你自报的测验未通过；先回看错题对应内容，再复测。", keepsActivityOpen: input.value !== "passed", riskLevel: "low" };
  if (input.type === "quiz_result" && typeof input.value === "number") {
    return input.value >= 70
      ? { outcome: "advance", confidence: 0.9, rationale: "课程测试达到继续标准。", keepsActivityOpen: false, riskLevel: "low" }
      : { outcome: "review", confidence: 0.85, rationale: "课程测试尚未达到继续标准，先回看当前范围。", keepsActivityOpen: true, riskLevel: "low" };
  }
  if (input.type === "scenario_choice") {
    if (input.context?.assessmentKind === "reflection") return { outcome: "review", confidence: 0.5, rationale: "这是通用学习反思，不能验证当前节点能力；请补充具体应用或理解反馈。", keepsActivityOpen: true, riskLevel: "low" };
    return input.context?.correct === true
      ? { outcome: "advance", confidence: 0.85, rationale: "情景判断抓住了当前节点的关键边界。", keepsActivityOpen: false, riskLevel: "low" }
      : { outcome: "review", confidence: 0.8, rationale: "情景判断暴露了当前节点的边界混淆，先做针对性回看。", keepsActivityOpen: true, riskLevel: "low" };
  }
  if (input.type === "stuck") {
    const prerequisite = /前置|基础|术语|完全不懂|看不懂/.test(`${input.value} ${input.note}`);
    return prerequisite
      ? { outcome: "repair_prerequisite", confidence: 0.8, rationale: "卡点指向前置理解缺口。", keepsActivityOpen: true, riskLevel: "low" }
      : { outcome: "reduce_scope", confidence: 0.7, rationale: "先缩小当前学习范围，避免直接改写路线。", keepsActivityOpen: true, riskLevel: "low" };
  }
  if (input.type === "understanding" && input.value !== true && input.value !== "understood") {
    return { outcome: "review", confidence: 0.8, rationale: "用户尚未形成稳定理解，当前行动保持开放。", keepsActivityOpen: true, riskLevel: "low" };
  }
  if (input.type === "judgment" && typeof input.value === "string" && input.value.trim().length < 12) {
    return { outcome: "review", confidence: 0.6, rationale: "当前判断信号过短，先补一个更具体的情景判断。", keepsActivityOpen: true, riskLevel: "low" };
  }
  return { outcome: "advance", confidence: 0.75, rationale: "当前学习信号足以继续已确认路线。", keepsActivityOpen: false, riskLevel: "low" };
}
