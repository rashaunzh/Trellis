import { D1Store } from "@mastra/cloudflare-d1";
import { Mastra } from "@mastra/core/mastra";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { learningIntakeSchema, type CurriculumRecord } from "./course-intelligence.ts";
import type { CourseIntelligenceRepository, WorkflowRunRecord } from "./repository.ts";
import type { CourseIntelligenceService } from "./service.ts";

const WORKFLOW_ID = "course-intelligence-learning-loop";
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

// D1 仍是业务事实来源；Mastra storage 仅保存工作流快照和恢复位置。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCourseIntelligenceRuntime(service: CourseIntelligenceService, db?: any) {
  const workflow = buildWorkflow(service);
  return new Mastra({
    ...(db ? {
      storage: new D1Store({
        id: "trellis-workflows",
        binding: db,
        tablePrefix: "mastra_",
      }),
    } : {}),
    workflows: { courseIntelligenceLearningLoop: workflow },
  });
}

export async function startCourseIntelligenceWorkflow(input: {
  ownerId: string;
  rawIntake: unknown;
  service: CourseIntelligenceService;
  repository: CourseIntelligenceRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
}): Promise<{ workflowRunId: string; status: "suspended"; curriculum: CurriculumRecord }> {
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
  return { workflowRunId: run.runId, status: "suspended", curriculum };
}

export async function resumeCourseIntelligenceWorkflow(input: {
  ownerId: string;
  curriculumId: string;
  approved: boolean;
  service: CourseIntelligenceService;
  repository: CourseIntelligenceRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
}): Promise<{ workflowRunId: string; status: WorkflowRunRecord["status"]; curriculum: CurriculumRecord }> {
  const workflowRun = await input.repository.getWorkflowRunByAggregate(input.ownerId, input.curriculumId);
  if (!workflowRun) {
    // 兼容 0015 之前创建的草案；确认仍保持幂等。
    const curriculum = input.approved
      ? await input.service.confirmCurriculum(input.ownerId, input.curriculumId)
      : await requiredCurriculum(input.service, input.ownerId, input.curriculumId);
    return { workflowRunId: "legacy", status: input.approved ? "completed" : "cancelled", curriculum };
  }
  if (["completed", "cancelled"].includes(workflowRun.status)) {
    return {
      workflowRunId: workflowRun.id,
      status: workflowRun.status,
      curriculum: await requiredCurriculum(input.service, input.ownerId, input.curriculumId),
    };
  }
  const runtime = createCourseIntelligenceRuntime(input.service, input.db);
  const workflow = runtime.getWorkflow("courseIntelligenceLearningLoop");
  const run = await workflow.createRun({ runId: workflowRun.id, resourceId: input.ownerId, disableScorers: true });
  try {
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
    return {
      workflowRunId: workflowRun.id,
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
  id: WORKFLOW_ID,
  steps: ["create-curriculum-draft", approvalStepId, "learning-active"],
  durableStateOwner: "mastra-d1-store",
  businessStateOwner: "trellis-d1",
} as const;
