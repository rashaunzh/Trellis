import { D1Store } from "@mastra/cloudflare-d1";
import { Mastra } from "@mastra/core/mastra";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { learningIntakeSchema, learningSignalInputSchema, type CurriculumRecord } from "./course-intelligence.ts";
import type { CourseIntelligenceRepository, WorkflowRunRecord } from "./repository.ts";
import type { CourseIntelligenceService } from "./service.ts";
import { hashInput } from "./model-gateway.ts";
import { transitionDecision, type DecisionRecord } from "./decision-kernel.ts";

const WORKFLOW_ID = "curriculum-synthesis-workflow";
const COURSE_ANALYSIS_WORKFLOW_ID = "course-analysis-workflow";
const LEARNING_ADAPTATION_WORKFLOW_ID = "learning-adaptation-workflow";
const SOURCE_EVOLUTION_WORKFLOW_ID = "source-evolution-workflow";
const approvalStepId = "confirm-curriculum";

const workflowInputSchema = z.object({
  ownerId: z.string().min(1),
  intake: learningIntakeSchema,
});

const draftOutputSchema = z.object({
  ownerId: z.string(),
  curriculumId: z.string(),
});

const workflowOutputSchema = z.object({
  curriculumId: z.string(),
  activationStatus: z.enum(["inactive", "activating", "active", "failed"]),
});

function buildWorkflow(service: CourseIntelligenceService) {
  const createDraft = createStep({
    id: "create-curriculum-draft",
    inputSchema: workflowInputSchema,
    outputSchema: draftOutputSchema,
    execute: async ({ inputData }) => {
      const curriculum = await service.createCurriculum(inputData.ownerId, inputData.intake);
      return { ownerId: inputData.ownerId, curriculumId: curriculum.id };
    },
  });

  const confirmCurriculum = createStep({
    id: approvalStepId,
    inputSchema: draftOutputSchema,
    outputSchema: workflowOutputSchema,
    resumeSchema: z.object({ approved: z.boolean() }),
    suspendSchema: z.object({
      reason: z.string(),
      curriculumId: z.string(),
    }),
    execute: async ({ inputData, resumeData, suspend, bail }) => {
      if (resumeData?.approved === false) {
        return bail({ curriculumId: inputData.curriculumId, activationStatus: "inactive" as const });
      }
      if (resumeData?.approved !== true) {
        return await suspend({
          reason: "请检查课程取舍、准确章节、跳过项和缺口后再确认。",
          curriculumId: inputData.curriculumId,
        });
      }
      const curriculum = await service.confirmCurriculum(inputData.ownerId, inputData.curriculumId);
      return { curriculumId: curriculum.id, activationStatus: curriculum.activationStatus };
    },
  });

  return createWorkflow({
    id: WORKFLOW_ID,
    description: "从目标输入创建课程组合，等待用户确认后原子激活正式学习路线。",
    inputSchema: workflowInputSchema,
    outputSchema: workflowOutputSchema,
  })
    .then(createDraft)
    .then(confirmCurriculum)
    .commit();
}

function buildCourseAnalysisWorkflow(service: CourseIntelligenceService) {
  const analyze = createStep({
    id: "analyze-course-material",
    inputSchema: z.object({ ownerId: z.string().min(1), material: z.unknown() }),
    outputSchema: z.object({ ownerId: z.string(), status: z.string(), candidateId: z.string().nullable() }),
    execute: async ({ inputData }) => {
      const result = await service.analyzeMaterial(inputData.ownerId, inputData.material);
      return { ownerId: inputData.ownerId, status: result.status, candidateId: result.candidateId };
    },
  });
  const review = createStep({
    id: "review-course-candidate",
    inputSchema: z.object({ ownerId: z.string(), status: z.string(), candidateId: z.string().nullable() }),
    outputSchema: z.object({ status: z.string(), candidateId: z.string().nullable() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    suspendSchema: z.object({ reason: z.string(), candidateId: z.string() }),
    execute: async ({ inputData, resumeData, suspend, bail }) => {
      if (!inputData.candidateId) return { status: inputData.status, candidateId: null };
      if (resumeData?.approved === false) return bail({ status: "rejected", candidateId: inputData.candidateId });
      if (resumeData?.approved !== true) {
        return suspend({ reason: "候选课程必须核对章节、节点映射和来源后才能发布。", candidateId: inputData.candidateId });
      }
      return { status: "validated", candidateId: inputData.candidateId };
    },
  });
  return createWorkflow({
    id: COURSE_ANALYSIS_WORKFLOW_ID,
    description: "解析陌生课程并在进入共享目录前暂停等待内部评审。",
    inputSchema: z.object({ ownerId: z.string().min(1), material: z.unknown() }),
    outputSchema: z.object({ status: z.string(), candidateId: z.string().nullable() }),
  }).then(analyze).then(review).commit();
}

function buildLearningAdaptationWorkflow(service: CourseIntelligenceService) {
  const interpret = createStep({
    id: "interpret-learning-signal",
    inputSchema: z.object({ ownerId: z.string().min(1), activityId: z.string().min(1), signal: learningSignalInputSchema }),
    outputSchema: z.object({
      decisionId: z.string(), riskLevel: z.enum(["low", "high"]), nextAction: z.string(),
      state: z.object({ nodeId: z.string(), status: z.string(), confidence: z.number() }),
      interpretation: z.object({ outcome: z.string(), rationale: z.string(), keepsActivityOpen: z.boolean() }),
    }),
    execute: async ({ inputData }) => {
      const result = await service.recordLearningSignal(inputData.ownerId, inputData.activityId, inputData.signal);
      return {
        decisionId: result.decision.id, riskLevel: result.decision.riskLevel, nextAction: result.nextAction,
        state: { nodeId: result.state.nodeId, status: result.state.status, confidence: result.state.confidence },
        interpretation: {
          outcome: result.interpretation.outcome, rationale: result.interpretation.rationale,
          keepsActivityOpen: result.interpretation.keepsActivityOpen,
        },
      };
    },
  });
  return createWorkflow({
    id: LEARNING_ADAPTATION_WORKFLOW_ID,
    description: "解释学习信号，自动应用低风险调整并把高风险调整交给用户确认。",
    inputSchema: z.object({ ownerId: z.string().min(1), activityId: z.string().min(1), signal: learningSignalInputSchema }),
    outputSchema: z.object({
      decisionId: z.string(), riskLevel: z.enum(["low", "high"]), nextAction: z.string(),
      state: z.object({ nodeId: z.string(), status: z.string(), confidence: z.number() }),
      interpretation: z.object({ outcome: z.string(), rationale: z.string(), keepsActivityOpen: z.boolean() }),
    }),
  }).then(interpret).commit();
}

function buildSourceEvolutionWorkflow(service: CourseIntelligenceService) {
  const refresh = createStep({
    id: "scan-source-version",
    inputSchema: z.object({ sourceId: z.string().min(1) }),
    outputSchema: z.object({ jobId: z.string(), sourceId: z.string(), status: z.enum(["candidate", "unchanged"]) }),
    execute: async ({ inputData }) => {
      const job = await service.refreshSource(inputData.sourceId);
      return { jobId: job.id, sourceId: inputData.sourceId, status: job.status };
    },
  });
  const review = createStep({
    id: "review-source-impact",
    inputSchema: z.object({ jobId: z.string(), sourceId: z.string(), status: z.enum(["candidate", "unchanged"]) }),
    outputSchema: z.object({ jobId: z.string(), status: z.string() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    suspendSchema: z.object({ reason: z.string(), jobId: z.string() }),
    execute: async ({ inputData, resumeData, suspend, bail }) => {
      if (inputData.status === "unchanged") return { jobId: inputData.jobId, status: "unchanged" };
      if (resumeData?.approved === false) return bail({ jobId: inputData.jobId, status: "rejected" });
      if (resumeData?.approved !== true) {
        return suspend({ reason: "来源变化需要先检查课程结构和受影响路线。", jobId: inputData.jobId });
      }
      return { jobId: inputData.jobId, status: "reviewed" };
    },
  });
  return createWorkflow({
    id: SOURCE_EVOLUTION_WORKFLOW_ID,
    description: "扫描来源变化，生成差异候选并在发布前暂停评审。",
    inputSchema: z.object({ sourceId: z.string().min(1) }),
    outputSchema: z.object({ jobId: z.string(), status: z.string() }),
  }).then(refresh).then(review).commit();
}

// D1 仍是业务事实来源；Mastra storage 仅保存工作流快照和恢复位置。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCourseIntelligenceRuntime(service: CourseIntelligenceService, db?: any) {
  const workflow = buildWorkflow(service);
  const courseAnalysis = buildCourseAnalysisWorkflow(service);
  const learningAdaptation = buildLearningAdaptationWorkflow(service);
  const sourceEvolution = buildSourceEvolutionWorkflow(service);
  return new Mastra({
    ...(db ? {
      storage: new D1Store({
        id: "trellis-workflows",
        binding: db,
        tablePrefix: "mastra_",
      }),
    } : {}),
    workflows: {
      courseIntelligenceLearningLoop: workflow,
      courseAnalysis,
      learningAdaptation,
      sourceEvolution,
    },
  });
}

export async function startCourseAnalysisWorkflow(input: {
  ownerId: string; material: unknown; service: CourseIntelligenceService;
  repository: CourseIntelligenceRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
}) {
  const candidateIdsBeforeRun = new Set(
    (await input.repository.listCourseCandidates()).map((item) => item.id),
  );
  const runtime = createCourseIntelligenceRuntime(input.service, input.db);
  const run = await runtime.getWorkflow("courseAnalysis").createRun({
    runId: `course-analysis.${crypto.randomUUID()}`, resourceId: input.ownerId, disableScorers: true,
  });
  const result = await run.start({ inputData: { ownerId: input.ownerId, material: input.material } });
  const now = new Date().toISOString();
  const candidatesAfterRun = result.status === "suspended"
    ? await input.repository.listCourseCandidates()
    : [];
  const candidate = candidatesAfterRun.find((item) => item.workflowRunId === run.runId)
    ?? candidatesAfterRun.find((item) => item.ownerId === input.ownerId && !candidateIdsBeforeRun.has(item.id))
    ?? null;
  if (candidate && candidate.workflowRunId !== run.runId) {
    await input.repository.saveCourseCandidate({ ...candidate, workflowRunId: run.runId, updatedAt: now });
  }
  const aggregateId = candidate?.id ?? `material.${await hashInput(input.material)}`;
  const decision: DecisionRecord = {
    id: `decision.${crypto.randomUUID()}`, ownerId: input.ownerId, decisionType: "course_analysis",
    aggregateType: "course_candidate", aggregateId, workflowRunId: run.runId,
    riskLevel: candidate ? "high" : "low", status: candidate ? "needs_review" : "applied",
    inputHash: await hashInput(input.material), proposal: { candidateId: candidate?.id ?? null },
    rationale: { summary: candidate ? "陌生课程已形成候选，等待内容评审。" : "材料已匹配发布目录或暂不具备分析条件。" },
    citations: [], confidence: candidate ? 0.6 : 1, evalReport: {}, modelRoute: {},
    createdAt: now, updatedAt: now, appliedAt: candidate ? null : now,
  };
  await input.repository.saveDecision(decision, {
    id: `decision-event.${crypto.randomUUID()}`, decisionId: decision.id, fromStatus: null,
    toStatus: decision.status, actorType: "workflow", actorOwnerId: input.ownerId, detail: {}, createdAt: now,
  });
  await input.repository.saveWorkflowRun({
    id: run.runId, ownerId: input.ownerId, workflowId: COURSE_ANALYSIS_WORKFLOW_ID,
    aggregateType: "course_candidate", aggregateId,
    status: result.status === "suspended" ? "suspended" : result.status === "success" ? "completed" : "failed",
    currentStep: result.status === "suspended" ? "review-course-candidate" : "complete",
    lastError: result.status === "failed" ? "课程分析工作流失败" : "", createdAt: now, updatedAt: now,
  });
  return { workflowRunId: run.runId, decisionId: decision.id, status: result.status, candidateId: candidate?.id ?? null };
}

export async function startLearningAdaptationWorkflow(input: {
  ownerId: string; activityId: string; signal: unknown; service: CourseIntelligenceService;
  repository: CourseIntelligenceRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
}) {
  const signal = learningSignalInputSchema.parse(input.signal);
  const runtime = createCourseIntelligenceRuntime(input.service, input.db);
  const run = await runtime.getWorkflow("learningAdaptation").createRun({
    runId: `learning-adaptation.${crypto.randomUUID()}`, resourceId: input.ownerId, disableScorers: true,
  });
  const result = await run.start({ inputData: { ownerId: input.ownerId, activityId: input.activityId, signal } });
  if (result.status !== "success") throw new Error(`学习调整工作流失败：${result.status}`);
  const decision = await input.repository.getDecision(result.result.decisionId, input.ownerId);
  if (!decision) throw new Error("学习调整工作流没有生成决策");
  const now = new Date().toISOString();
  await input.repository.saveDecision({ ...decision, workflowRunId: run.runId, updatedAt: now });
  await input.repository.saveWorkflowRun({
    id: run.runId, ownerId: input.ownerId, workflowId: LEARNING_ADAPTATION_WORKFLOW_ID,
    aggregateType: "learning_activity", aggregateId: input.activityId, status: "completed", currentStep: "complete",
    lastError: "", createdAt: now, updatedAt: now,
  });
  return { workflowRunId: run.runId, status: "completed" as const, ...result.result };
}

export async function resumeCourseAnalysisWorkflow(input: {
  ownerId: string; candidateId: string; approved: boolean; reviewerOwnerId: string; reason: string;
  service: CourseIntelligenceService; repository: CourseIntelligenceRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
}) {
  const workflowRun = await input.repository.getWorkflowRunByAggregate(input.ownerId, input.candidateId);
  if (!workflowRun) throw Object.assign(new Error("课程分析工作流不存在"), { status: 404 });
  if (workflowRun.status === "completed" || workflowRun.status === "cancelled") return workflowRun;
  await input.service.reviewCourseCandidate({
    candidateId: input.candidateId, reviewerOwnerId: input.reviewerOwnerId,
    decision: input.approved ? "validated" : "rejected", reason: input.reason,
  });
  const runtime = createCourseIntelligenceRuntime(input.service, input.db);
  const run = await runtime.getWorkflow("courseAnalysis").createRun({
    runId: workflowRun.id, resourceId: input.ownerId, disableScorers: true,
  });
  const result = await run.resume({ step: "review-course-candidate", resumeData: { approved: input.approved } });
  const status: WorkflowRunRecord["status"] = input.approved && result.status === "success"
    ? "completed" : input.approved ? "failed" : "cancelled";
  const updated = { ...workflowRun, status, currentStep: status === "completed" ? "complete" : "review-course-candidate", updatedAt: new Date().toISOString() };
  await input.repository.saveWorkflowRun(updated);
  const decision = (await input.repository.listDecisions(input.ownerId)).find((item) => item.workflowRunId === workflowRun.id);
  if (decision && decision.status === "needs_review") {
    const changed = transitionDecision({ decision, toStatus: input.approved ? "accepted" : "rejected", actorType: "admin", actorOwnerId: input.reviewerOwnerId });
    await input.repository.saveDecision(changed.decision, changed.event);
  }
  return updated;
}

export async function resumeSourceEvolutionWorkflow(input: {
  decision: DecisionRecord; approved: boolean; actorOwnerId: string;
  service: CourseIntelligenceService; repository: CourseIntelligenceRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
}) {
  if (!input.decision.workflowRunId) throw Object.assign(new Error("来源演进决策没有工作流"), { status: 409 });
  const workflowRun = await input.repository.getWorkflowRun(input.decision.workflowRunId, "system");
  if (!workflowRun) throw Object.assign(new Error("来源演进工作流不存在"), { status: 404 });
  if (["completed", "cancelled"].includes(workflowRun.status)
    || ["applied", "rejected"].includes(input.decision.status)) return input.decision;
  const runtime = createCourseIntelligenceRuntime(input.service, input.db);
  const run = await runtime.getWorkflow("sourceEvolution").createRun({
    runId: workflowRun.id, resourceId: input.decision.aggregateId, disableScorers: true,
  });
  const result = await run.resume({ step: "review-source-impact", resumeData: { approved: input.approved } });
  const first = transitionDecision({
    decision: input.decision, toStatus: input.approved ? "accepted" : "rejected",
    actorType: "admin", actorOwnerId: input.actorOwnerId,
  });
  await input.repository.saveDecision(first.decision, first.event);
  let finalDecision = first.decision;
  if (input.approved && result.status === "success") {
    const applied = transitionDecision({ decision: first.decision, toStatus: "applied", actorType: "workflow", actorOwnerId: input.actorOwnerId });
    finalDecision = applied.decision;
    await input.repository.saveDecision(finalDecision, applied.event);
  }
  const status: WorkflowRunRecord["status"] = input.approved && result.status === "success" ? "completed" : input.approved ? "failed" : "cancelled";
  await input.repository.saveWorkflowRun({ ...workflowRun, status, currentStep: status === "completed" ? "complete" : "review-source-impact", updatedAt: new Date().toISOString() });
  return finalDecision;
}

export async function startSourceEvolutionWorkflow(input: {
  sourceId: string; service: CourseIntelligenceService; repository: CourseIntelligenceRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
}) {
  const runtime = createCourseIntelligenceRuntime(input.service, input.db);
  const run = await runtime.getWorkflow("sourceEvolution").createRun({
    runId: `source-evolution.${crypto.randomUUID()}`, resourceId: input.sourceId, disableScorers: true,
  });
  const result = await run.start({ inputData: { sourceId: input.sourceId } });
  const now = new Date().toISOString();
  const status = result.status === "suspended" ? "suspended" : result.status === "success" ? "completed" : "failed";
  const decision: DecisionRecord = {
    id: `decision.${crypto.randomUUID()}`, ownerId: "system", decisionType: "source_evolution",
    aggregateType: "source", aggregateId: input.sourceId, workflowRunId: run.runId,
    riskLevel: result.status === "suspended" ? "high" : "low",
    status: result.status === "suspended" ? "needs_review" : result.status === "success" ? "applied" : "failed",
    inputHash: await hashInput({ sourceId: input.sourceId, workflowRunId: run.runId }),
    proposal: { sourceId: input.sourceId, requiresReview: result.status === "suspended" },
    rationale: { summary: result.status === "suspended" ? "来源发生变化，需要评估课程和路线影响。" : "来源未变化。" },
    citations: [], confidence: 1, evalReport: {}, modelRoute: { mode: "deterministic-source-diff" },
    createdAt: now, updatedAt: now, appliedAt: result.status === "success" ? now : null,
  };
  await input.repository.saveDecision(decision, {
    id: `decision-event.${crypto.randomUUID()}`, decisionId: decision.id, fromStatus: null,
    toStatus: decision.status, actorType: "workflow", actorOwnerId: "system", detail: {}, createdAt: now,
  });
  await input.repository.saveWorkflowRun({
    id: run.runId, ownerId: "system", workflowId: SOURCE_EVOLUTION_WORKFLOW_ID,
    aggregateType: "source", aggregateId: input.sourceId, status, currentStep: status === "suspended" ? "review-source-impact" : "complete",
    lastError: status === "failed" ? "来源演进工作流失败" : "", createdAt: now, updatedAt: now,
  });
  return { workflowRunId: run.runId, decisionId: decision.id, status: result.status };
}

export async function startCourseIntelligenceWorkflow(input: {
  ownerId: string;
  rawIntake: unknown;
  service: CourseIntelligenceService;
  repository: CourseIntelligenceRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
}): Promise<{ workflowRunId: string; decisionId: string; status: "suspended"; curriculum: CurriculumRecord }> {
  const intake = learningIntakeSchema.parse(input.rawIntake);
  const runtime = createCourseIntelligenceRuntime(input.service, input.db);
  const workflow = runtime.getWorkflow("courseIntelligenceLearningLoop");
  const run = await workflow.createRun({
    runId: `course-intelligence.${crypto.randomUUID()}`,
    resourceId: input.ownerId,
    disableScorers: true,
  });
  const result = await run.start({ inputData: { ownerId: input.ownerId, intake } });
  if (result.status !== "suspended") {
    throw new Error(`课程编排工作流未进入确认状态：${result.status}`);
  }
  const curriculum = await input.repository.getLatestCurriculum(input.ownerId);
  if (!curriculum) throw new Error("课程编排工作流没有生成课程方案");
  const now = new Date().toISOString();
  const selectedConfidences = curriculum.assembly.decisions
    .filter((item) => item.selectedUnitIds.length > 0)
    .map((item) => item.confidence);
  let decision: DecisionRecord = {
    id: `decision.${crypto.randomUUID()}`, ownerId: input.ownerId,
    decisionType: "curriculum_synthesis", aggregateType: "curriculum", aggregateId: curriculum.id,
    workflowRunId: run.runId, riskLevel: "high", status: "generated",
    inputHash: await hashInput({ intake, assembly: curriculum.assembly }),
    proposal: { curriculumId: curriculum.id, assembly: curriculum.assembly },
    rationale: { summary: curriculum.assembly.rationale },
    citations: curriculum.assembly.decisions.flatMap((item) => item.sourceCitations),
    confidence: selectedConfidences.length > 0 ? Math.min(...selectedConfidences) : 0.5,
    evalReport: { passed: true }, modelRoute: { mode: "solver-v2" },
    createdAt: now, updatedAt: now, appliedAt: null,
  };
  await input.repository.saveDecision(decision, {
    id: `decision-event.${crypto.randomUUID()}`, decisionId: decision.id, fromStatus: null,
    toStatus: "generated", actorType: "workflow", actorOwnerId: input.ownerId,
    detail: { workflowRunId: run.runId }, createdAt: now,
  });
  const proposed = transitionDecision({ decision, toStatus: "proposed", actorType: "workflow", actorOwnerId: input.ownerId, now });
  decision = proposed.decision;
  await input.repository.saveDecision(decision, proposed.event);
  await input.repository.saveWorkflowRun({
    id: run.runId,
    ownerId: input.ownerId,
    workflowId: WORKFLOW_ID,
    aggregateType: "curriculum",
    aggregateId: curriculum.id,
    status: "suspended",
    currentStep: approvalStepId,
    lastError: "",
    createdAt: now,
    updatedAt: now,
  });
  return { workflowRunId: run.runId, decisionId: decision.id, status: "suspended", curriculum };
}

export async function resumeCourseIntelligenceWorkflow(input: {
  ownerId: string;
  curriculumId: string;
  approved: boolean;
  service: CourseIntelligenceService;
  repository: CourseIntelligenceRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
}): Promise<{ workflowRunId: string; decisionId: string | null; status: WorkflowRunRecord["status"]; curriculum: CurriculumRecord }> {
  const workflowRun = await input.repository.getWorkflowRunByAggregate(input.ownerId, input.curriculumId);
  let decision = (await input.repository.listDecisions(input.ownerId)).find((item) =>
    item.aggregateType === "curriculum" && item.aggregateId === input.curriculumId) ?? null;
  if (!workflowRun) {
    // 兼容 0015 之前创建的草案；确认仍保持幂等。
    const curriculum = input.approved
      ? await input.service.confirmCurriculum(input.ownerId, input.curriculumId)
      : await requiredCurriculum(input.service, input.ownerId, input.curriculumId);
    return { workflowRunId: "legacy", decisionId: decision?.id ?? null, status: input.approved ? "completed" : "cancelled", curriculum };
  }
  if (["completed", "cancelled"].includes(workflowRun.status)) {
    return {
      workflowRunId: workflowRun.id,
      decisionId: decision?.id ?? null,
      status: workflowRun.status,
      curriculum: await requiredCurriculum(input.service, input.ownerId, input.curriculumId),
    };
  }
  const runtime = createCourseIntelligenceRuntime(input.service, input.db);
  const workflow = runtime.getWorkflow("courseIntelligenceLearningLoop");
  const run = await workflow.createRun({ runId: workflowRun.id, resourceId: input.ownerId, disableScorers: true });
  try {
    if (decision && ["proposed", "needs_review"].includes(decision.status)) {
      const changed = transitionDecision({
        decision,
        toStatus: input.approved ? "accepted" : "rejected",
        actorType: "user",
        actorOwnerId: input.ownerId,
      });
      decision = changed.decision;
      await input.repository.saveDecision(decision, changed.event);
    }
    const result = await run.resume({
      step: approvalStepId,
      resumeData: { approved: input.approved },
    });
    const status: WorkflowRunRecord["status"] = input.approved && result.status === "success"
      ? "completed"
      : input.approved
        ? "failed"
        : "cancelled";
    await input.repository.saveWorkflowRun({
      ...workflowRun,
      status,
      currentStep: status === "completed" ? "learning-active" : approvalStepId,
      lastError: status === "failed" ? `工作流恢复失败：${result.status}` : "",
      updatedAt: new Date().toISOString(),
    });
    if (input.approved && status === "completed" && decision?.status === "accepted") {
      const applied = transitionDecision({ decision, toStatus: "applied", actorType: "workflow", actorOwnerId: input.ownerId });
      decision = applied.decision;
      await input.repository.saveDecision(decision, applied.event);
    }
    return {
      workflowRunId: workflowRun.id,
      decisionId: decision?.id ?? null,
      status,
      curriculum: await requiredCurriculum(input.service, input.ownerId, input.curriculumId),
    };
  } catch (error) {
    await input.repository.saveWorkflowRun({
      ...workflowRun,
      status: "failed",
      lastError: error instanceof Error ? error.message : "工作流恢复失败",
      updatedAt: new Date().toISOString(),
    });
    throw error;
  }
}

async function requiredCurriculum(service: CourseIntelligenceService, ownerId: string, id: string) {
  const curriculum = await service.getCurriculum(ownerId, id);
  if (!curriculum) throw Object.assign(new Error("课程方案不存在"), { status: 404 });
  return curriculum;
}

export const courseIntelligenceWorkflowSpec = {
  ids: [WORKFLOW_ID, COURSE_ANALYSIS_WORKFLOW_ID, LEARNING_ADAPTATION_WORKFLOW_ID, SOURCE_EVOLUTION_WORKFLOW_ID],
  steps: ["create-curriculum-draft", approvalStepId, "analyze-course-material", "review-course-candidate", "interpret-learning-signal", "scan-source-version", "review-source-impact"],
  durableStateOwner: "mastra-d1-store",
  businessStateOwner: "trellis-d1",
} as const;
