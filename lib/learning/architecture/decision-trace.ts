import type { LearningSignalType } from "../agents/types.ts";

export type TraceTrigger =
  | "diagnostic"
  | "material_review"
  | "stage_planning"
  | "dynamic_adjustment"
  | "artifact_task"
  | "evidence_review"
  | "mastery_confirmation"
  | "next_stage";

export type TraceInputType = "goal" | "material" | "state" | "evidence" | "signal" | "activity";
export type TraceSignalType = LearningSignalType | "material_signal" | "state_signal";

export interface LearningDecisionTrace {
  traceId: string;
  trigger: TraceTrigger;
  ownerId: string;
  startedAt: string;
  completedAt?: string;
  inputs: Array<{ name: string; type: TraceInputType; summary: string }>;
  signals: Array<{
    type: TraceSignalType;
    label: string;
    value: string;
    weight: "blocking" | "strong" | "medium" | "weak";
  }>;
  steps: Array<{ id: string; tool: string; summary: string; humanInTheLoop: boolean }>;
  decision: { kind: string; summary: string; requiresConfirmation: boolean };
  stateChanges: Array<{
    target: "profile" | "weeklyPlan" | "activity" | "evidence" | "nodeProgress" | "adjustment";
    action: "proposed" | "created" | "updated" | "accepted" | "rejected" | "none";
    summary: string;
  }>;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function createDecisionTrace(input: {
  ownerId: string;
  trigger: TraceTrigger;
  kind: string;
  summary: string;
  requiresConfirmation?: boolean;
  inputs?: LearningDecisionTrace["inputs"];
  signals?: LearningDecisionTrace["signals"];
  steps?: LearningDecisionTrace["steps"];
  stateChanges?: LearningDecisionTrace["stateChanges"];
}): LearningDecisionTrace {
  const startedAt = new Date().toISOString();
  return {
    traceId: `trace-${stableHash(`${input.ownerId}:${input.trigger}:${input.kind}:${input.summary}`)}`,
    trigger: input.trigger,
    ownerId: input.ownerId,
    startedAt,
    completedAt: startedAt,
    inputs: input.inputs ?? [],
    signals: input.signals ?? [],
    steps: input.steps ?? [],
    decision: {
      kind: input.kind,
      summary: input.summary,
      requiresConfirmation: input.requiresConfirmation ?? false,
    },
    stateChanges: input.stateChanges ?? [],
  };
}
