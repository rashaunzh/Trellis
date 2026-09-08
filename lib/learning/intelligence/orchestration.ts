import type { UserResource } from "../domain/types.ts";
import type { CourseIntelligenceState, CurrentLearningState } from "./service.ts";
import type { CurriculumRecord } from "./course-intelligence.ts";

export type SituationEntryMode = "zero_material" | "guided_sources" | "source_overload";
export type CapabilityState = "unstarted" | "touched" | "growing" | "validated" | "review_due";
export type TriageVerdict = "use_now" | "triage" | "review_later" | "evidence_candidate";
export type AssessmentKind = "diagnostic" | "exit_ticket" | "scenario" | "teach_back" | "retest" | "rubric";
export type ArtifactState = "draft" | "needs_review" | "needs_revision" | "portfolio_ready" | "capability_evidence";
export type LearningDecisionKind = "situation" | "content_decomposition" | "prioritization" | "task_generation" | "adaptation";

export interface LearningOrchestrationState {
  situation: {
    entryMode: SituationEntryMode;
    goalHypothesis: string;
    goalRaw: string;
    targetUse: string;
    currentUncertainty: string;
    weeklyMinutes: number;
    materialCount: number;
    nextBestMove: string;
  };
  weeklyPackage: {
    mission: string;
    whyThisWeek: string;
    capacityMinutes: number;
    plannedMinutes: number;
    taskCount: number;
    currentTaskId: string | null;
    tasks: Array<{
      id: string;
      title: string;
      capabilityNodeIds: string[];
      capabilityTitles: string[];
      capabilityProblem: string;
      objective: string;
      whyNow: string;
      learningMode: string;
      expectedOutcome: string;
      sourceFragments: Array<{ title: string; url: string | null; locator: string; precision: string }>;
      assessment: AssessmentKind;
      stopCondition: string;
      failureAction: string;
      pathMeaning: string;
      evidenceSignal: string;
      estimatedMinutes: number;
      isCore: boolean;
      sequence: number;
      status: string;
    }>;
    coreTaskIds: string[];
    optionalTaskIds: string[];
    ordering: Array<{ taskId: string; relation: "after" | "parallel" | "optional"; dependsOn: string[] }>;
    completionCriteria: string[];
    stopConditions: string[];
  } | null;
  decisionTrace: Array<{
    id: string;
    kind: LearningDecisionKind;
    label: string;
    rationale: string;
    confidence: number;
    status: "applied" | "pending" | "historical";
    inputSummary: string;
  }>;
  capabilityModel: {
    title: string;
    dimensions: Array<{
      id: string;
      title: string;
      state: CapabilityState;
      level: number;
      evidenceCount: number;
      nextMilestone: string;
      branch: string;
    }>;
    pathBranches: Array<{
      id: string;
      title: string;
      nodeIds: string[];
      status: "selected" | "adjacent" | "available";
    }>;
  };
  controlCenter: {
    sourceCenter: Array<{
      id: string;
      title: string;
      kind: "course" | "resource" | "tool" | "note" | "external";
      verdict: TriageVerdict;
      reason: string;
      mappedNodeTitles: string[];
      nextAction: string;
      url: string | null;
    }>;
    testMachine: Array<{
      id: string;
      title: string;
      kind: AssessmentKind;
      status: "ready" | "scheduled" | "blocked" | "done";
      target: string;
      reason: string;
    }>;
    artifactGallery: Array<{
      id: string;
      title: string;
      state: ArtifactState;
      proves: string[];
      source: string;
      nextAction: string;
    }>;
  };
}

const capacityMinutes = { light: 120, steady: 240, focused: 360, intensive: 540 } as const;

export function buildLearningOrchestrationState(input: {
  state: CourseIntelligenceState;
  current: CurrentLearningState;
  resources: UserResource[];
}): LearningOrchestrationState {
  const { state, current, resources } = input;
  const curriculum = current.curriculum ?? state.curriculum;
  const goalRaw = curriculum?.intake.goal ?? "";
  const materialCount = (curriculum?.intake.materials.length ?? resources.filter((item) => item.type === "resource").length)
    + new Set(curriculum?.assembly.sourceSelections?.map(item => item.sourceId) ?? []).size;
  const weeklyMinutes = current.weeklyPlan?.capacityMinutes
    ?? (curriculum ? capacityMinutes[curriculum.intake.weeklyCapacity] : 240);
  const entryMode: SituationEntryMode = materialCount === 0 ? "zero_material" : materialCount >= 5 ? "source_overload" : "guided_sources";
  const activeTask = current.activities.find((activity) => activity.id === current.resumeState.activityId)
    ?? current.activities.find((activity) => activity.status !== "completed")
    ?? null;
  const nodeById = new Map(state.graph.nodes.map((node) => [node.id, node]));
  const knowledgeByNode = new Map(current.knowledgeStates.map((item) => [item.nodeId, item]));
  const activeNodeIds = new Set(curriculum?.assembly.targetNodeIds ?? []);

  const tasks = current.activities.map((activity) => {
    const nodeIds = activity.scope?.nodeIds ?? (activity.canonicalNodeId ? [activity.canonicalNodeId] : [activity.nodeId]);
    const sourceUrl = activity.scope?.sourceUrl || activity.inputRefs.find((ref) => /^https?:\/\//.test(ref)) || null;
    return {
      id: activity.id,
      title: titleWithoutCoursePrefix(activity.title),
      capabilityNodeIds: nodeIds,
      capabilityTitles: nodeIds.map((id) => nodeById.get(id)?.title ?? id),
      capabilityProblem: nodeIds.length > 0
        ? `当前需要验证你是否能在真实情境中使用“${nodeIds.map((id) => nodeById.get(id)?.title ?? id).join("、")}”。`
        : "当前需要把材料理解转成一个可观察的判断。",
      objective: objectiveFromActivity(activity.goal, nodeIds.map((id) => nodeById.get(id)?.title ?? id)),
      whyNow: activity.nextAdvice || "它是当前路线的下一步，先留下信号才能判断是否需要补前置或进入下一分支。",
      learningMode: learningModeOf(activity.activityType),
      expectedOutcome: activity.expectedEvidence || activity.evaluationCriteria || "留下一个可复核的学习信号。",
      sourceFragments: [{
        title: titleWithoutCoursePrefix(activity.scope?.locatorLabel || activity.title),
        url: sourceUrl,
        locator: activity.scope?.locatorLabel || "当前材料片段",
        precision: activity.scope?.locatorMissing ? "只能定位到来源主页" : "可定位到片段",
      }, ...(curriculum?.assembly.sourceSelections ?? []).filter(item => item.role !== "defer" && item.nodeIds.some(id => nodeIds.includes(id))).map(item => ({
        title: item.title, url: item.url ?? "", locator: `已审阅片段 · 分析版本 ${item.analysisVersion}`, precision: item.role === "adopted" ? "已纳入路线，保留原文依据" : "可选补充，未核验完整内容",
      }))],
      assessment: assessmentKindFor(activity.activityType),
      stopCondition: activity.scope?.stopCondition ?? activity.evaluationCriteria,
      failureAction: failureActionOf(activity.activityType),
      pathMeaning: pathMeaningOf(nodeIds[0] ?? null, nodeById),
      evidenceSignal: activity.scope?.completionSignal ?? activity.expectedEvidence,
      estimatedMinutes: activity.estimatedMinutes,
      isCore: activity.isCore,
      sequence: activity.sequence,
      status: activity.status,
    };
  });

  const dimensions = state.graph.nodes
    .filter((node) => activeNodeIds.has(node.id) || tasks.some((task) => task.capabilityNodeIds.includes(node.id)))
    .map((node) => {
      const knowledge = knowledgeByNode.get(node.id);
      const relatedTasks = tasks.filter((task) => task.capabilityNodeIds.includes(node.id));
      return {
        id: node.id,
        title: node.title,
        state: capabilityStateOf(knowledge?.status, relatedTasks.some((task) => task.status === "completed")),
        level: Math.max(0, Math.min(3, knowledge?.confidence ?? 0)),
        evidenceCount: knowledge?.latestSignalId ? 1 : 0,
        nextMilestone: node.outcomes[0] ?? "用一次真实任务证明这项能力",
        branch: state.graph.categories.find((category) => category.id === node.categoryId)?.title ?? "能力分支",
      };
    });

  return {
    situation: {
      entryMode,
      goalHypothesis: goalHypothesisOf(goalRaw, entryMode),
      goalRaw,
      targetUse: targetUseOf(goalRaw),
      currentUncertainty: uncertaintyOf(entryMode),
      weeklyMinutes,
      materialCount,
      nextBestMove: activeTask
        ? `完成“${titleWithoutCoursePrefix(activeTask.title)}”并留下一个可判断的学习信号。`
        : curriculum ? "本周任务已完成，先做周复盘再生成下一周任务包。" : "先完成一次轻诊断，Trellis 会给出第一周起点。",
    },
    weeklyPackage: current.weeklyPlan ? {
      mission: missionOf(curriculum?.assembly.learnerIntent ?? goalRaw, tasks),
      whyThisWeek: current.weeklyPlan.rationale || curriculum?.assembly.rationale || "根据当前目标、起点和可用时间生成。",
      capacityMinutes: current.weeklyPlan.capacityMinutes,
      plannedMinutes: tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0),
      taskCount: tasks.length,
      currentTaskId: activeTask?.id ?? null,
      tasks,
      coreTaskIds: tasks.filter((task) => task.isCore).map((task) => task.id),
      optionalTaskIds: tasks.filter((task) => !task.isCore).map((task) => task.id),
      ordering: tasks.map((task, index) => ({
        taskId: task.id,
        relation: task.isCore ? "after" as const : "optional" as const,
        dependsOn: index > 0 && task.isCore ? [tasks[index - 1]!.id] : [],
      })),
      completionCriteria: tasks.filter((task) => task.isCore).map((task) => task.expectedOutcome),
      stopConditions: tasks.filter((task) => task.isCore).map((task) => task.stopCondition),
    } : null,
    decisionTrace: buildDecisionTrace(current, entryMode, curriculum, tasks),
    capabilityModel: {
      title: state.graph.title,
      dimensions,
      pathBranches: state.graph.categories.map((category) => {
        const nodeIds = state.graph.nodes.filter((node) => node.categoryId === category.id).map((node) => node.id);
        const selected = nodeIds.some((id) => activeNodeIds.has(id));
        return { id: category.id, title: category.title, nodeIds, status: selected ? "selected" : "adjacent" };
      }),
    },
    controlCenter: {
      sourceCenter: buildSourceCenter(state, current, resources, nodeById),
      testMachine: buildTestMachine(current, tasks),
      artifactGallery: buildArtifactGallery(current, tasks),
    },
  };
}

function titleWithoutCoursePrefix(value: string): string {
  const parts = value.split(" · ").map((item) => item.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(" · ") : value;
}

function goalHypothesisOf(goal: string, mode: SituationEntryMode): string {
  if (!goal.trim()) {
    return mode === "zero_material"
      ? "先建立一个可开始的学习目标假设，而不是要求你一次说准。"
      : "先把输入材料转成一个可检验的学习目标假设。";
  }
  if (/产品|PM|prd|评测|eval|场景|agent/i.test(goal)) return "学习目标假设：形成 AI 产品判断、评测与落地设计能力。";
  if (/雅思|IELTS|托福|考试/i.test(goal)) return "学习目标假设：围绕目标考试建立分项能力、题型策略和模考证据。";
  if (/篮球|投篮|运球|体能|战术/i.test(goal)) return "学习目标假设：围绕专项动作、身体能力和实战判断建立训练路径。";
  return "学习目标假设：先把模糊愿望转成可观察、可练习、可验证的能力目标。";
}

function targetUseOf(goal: string): string {
  if (/作品|portfolio|面试|求职/i.test(goal)) return "产出可评审的作品或面试证据";
  if (/做|设计|开发|实现|上线/i.test(goal)) return "在真实任务里独立完成判断或产出";
  if (/考试|雅思|IELTS|托福/i.test(goal)) return "用阶段测评和模考结果证明进步";
  return "先建立可复述、可迁移的基础判断";
}

function uncertaintyOf(mode: SituationEntryMode): string {
  if (mode === "zero_material") return "当前最大不确定点是起点与能力边界，而不是材料取舍。";
  if (mode === "source_overload") return "当前最大不确定点是来源重复、质量与优先级。";
  return "当前最大不确定点是已有材料分别覆盖哪些知识点。";
}

function objectiveFromActivity(goal: string, nodeTitles: string[]): string {
  if (nodeTitles.length > 0) return `推进能力：${nodeTitles.join("、")}。`;
  return goal;
}

function learningModeOf(activityType: string): string {
  if (activityType === "build_model") return "建立概念模型，再用自己的话解释";
  if (activityType === "follow_demo") return "跟随示例，观察判断过程";
  if (activityType === "independent_practice") return "独立完成一个小产出";
  if (activityType === "quiz" || activityType === "retest") return "用短测检查是否记住并能辨别";
  if (activityType === "integrated_task") return "在真实任务中综合使用";
  return "复盘并说明自己的判断";
}

function failureActionOf(activityType: string): string {
  if (activityType === "integrated_task") return "拆小任务，先补最影响当前产出的前置能力。";
  if (activityType === "quiz" || activityType === "retest") return "回看错题涉及的概念，再安排一次针对性复测。";
  return "缩小范围或补一个必要前置，不会静默改写整条路线。";
}

function pathMeaningOf(nodeId: string | null, nodeById: Map<string, { title: string; outcomes: string[] }>): string {
  if (!nodeId) return "这是把当前材料转成能力证据的第一步。";
  const node = nodeById.get(nodeId);
  return node?.outcomes[0] ? `完成后，你会更接近“${node.outcomes[0]}”。` : `完成后，系统会重新判断“${node?.title ?? nodeId}”是否已形成稳定信号。`;
}

function buildDecisionTrace(
  current: CurrentLearningState,
  entryMode: SituationEntryMode,
  curriculum: CurriculumRecord | null,
  tasks: Array<{ title: string; whyNow: string; capabilityTitles: string[] }>,
): LearningOrchestrationState["decisionTrace"] {
  const pending = current.pendingDecisions.map((decision) => ({
    id: decision.id,
    kind: decision.decisionType === "learning_adaptation" ? "adaptation" as const
      : decision.decisionType === "course_analysis" ? "content_decomposition" as const
        : decision.decisionType === "curriculum_synthesis" ? "prioritization" as const : "task_generation" as const,
    label: decision.decisionType === "learning_adaptation" ? "反馈后的调整" : decision.decisionType === "curriculum_synthesis" ? "本周优先级" : "来源理解",
    rationale: String(decision.rationale.summary ?? "等待进一步确认。"),
    confidence: decision.confidence,
    status: "pending" as const,
    inputSummary: "来自当前处境、来源分析或学习反馈。",
  }));
  return [
    {
      id: "trace.situation",
      kind: "situation",
      label: "学习处境",
      rationale: goalHypothesisOf(curriculum?.intake.goal ?? "", entryMode),
      confidence: entryMode === "zero_material" ? 0.55 : 0.78,
      status: "applied",
      inputSummary: `${entryModeLabelOf(entryMode)} · ${current.weeklyPlan?.capacityMinutes ?? 0} 分钟/周`,
    },
    {
      id: "trace.priority",
      kind: "prioritization",
      label: "本周优先级",
      rationale: tasks[0]?.whyNow ?? "先形成一个可验证的学习信号。",
      confidence: tasks.length > 0 ? 0.82 : 0.5,
      status: "applied",
      inputSummary: `${tasks.length} 个任务 · ${tasks[0]?.capabilityTitles.join("、") || "待诊断"}`,
    },
    ...pending,
  ];
}

function entryModeLabelOf(mode: SituationEntryMode): string {
  if (mode === "zero_material") return "零材料";
  if (mode === "source_overload") return "来源过载";
  return "已有来源";
}

function assessmentKindFor(activityType: string): AssessmentKind {
  if (activityType === "quiz") return "exit_ticket";
  if (activityType === "retest") return "retest";
  if (activityType === "integrated_task") return "rubric";
  if (activityType === "reflection") return "teach_back";
  return "scenario";
}

function capabilityStateOf(status: string | undefined, completed: boolean): CapabilityState {
  if (status === "confirmed") return "validated";
  if (status === "has_signal") return "growing";
  if (status === "learning") return "growing";
  if (completed) return "touched";
  return "unstarted";
}

function missionOf(goal: string, tasks: Array<{ capabilityTitles: string[] }>): string {
  const first = tasks.flatMap((task) => task.capabilityTitles)[0];
  if (first) return `本周只做一件事：把“${first}”推进到可判断。`;
  return goal ? `本周只做一件事：把“${goal}”转成可执行学习证据。` : "本周只做一件事：完成起点诊断。";
}

function buildSourceCenter(
  state: CourseIntelligenceState,
  current: CurrentLearningState,
  resources: UserResource[],
  nodeById: Map<string, { title: string }>,
): LearningOrchestrationState["controlCenter"]["sourceCenter"] {
  const sourceItems = resources.map((resource) => ({
    id: resource.id,
    title: resource.title,
    kind: resource.type === "resource" ? "resource" as const : resource.type === "link" ? "external" as const : resource.type,
    verdict: current.attachedResources.some((item) => item.id === resource.id) ? "use_now" as const
      : resource.type === "note" ? "evidence_candidate" as const
        : resource.sourceUrl ? "triage" as const : "review_later" as const,
    reason: current.attachedResources.some((item) => item.id === resource.id)
      ? "已进入当前任务上下文。"
      : resource.sourceUrl ? "有来源链接，适合先判断可信度、覆盖节点和是否重复。" : "缺少可验证来源，暂不影响正式路线。",
    mappedNodeTitles: resource.relatedNodeIds.map((id) => nodeById.get(id)?.title ?? id),
    nextAction: resource.sourceUrl ? "进入来源分诊，判断是否拆成学习片段。" : "补充来源或把它整理成学习反馈。",
    url: resource.sourceUrl || null,
  }));
  const courseItems = (current.curriculum ?? state.curriculum)?.assembly.decisions
    .filter((decision) => ["anchor", "selected_units", "supplement"].includes(decision.role))
    .slice(0, 4)
    .map((decision) => {
      const course = state.catalog.find((item) => item.id === decision.courseId);
      return {
        id: decision.courseId,
        title: course?.title ?? decision.courseId,
        kind: "course" as const,
        verdict: "use_now" as const,
        reason: decision.rationale,
        mappedNodeTitles: decision.selectedUnitIds.length ? [`${decision.selectedUnitIds.length} 个已选片段`] : ["当前能力入口"],
        nextAction: "只使用已映射片段，不把整门课当路线。",
        url: course?.url ?? null,
      };
    }) ?? [];
  return [...courseItems, ...sourceItems];
}

function buildTestMachine(
  current: CurrentLearningState,
  tasks: LearningOrchestrationState["weeklyPackage"] extends infer T
    ? T extends { tasks: infer U } ? U extends Array<infer V> ? V[] : never : never
    : never,
): LearningOrchestrationState["controlCenter"]["testMachine"] {
  const active = tasks.find((task) => task.id === current.resumeState.activityId) ?? tasks.find((task) => task.status !== "completed");
  return [
    {
      id: "assessment.diagnostic",
      title: "起点诊断",
      kind: "diagnostic",
      status: current.curriculum ? "done" : "ready",
      target: "目标清晰度、起点能力、材料状态",
      reason: current.curriculum ? "已形成当前路线假设。" : "零材料用户也可以从这里启动。",
    },
    {
      id: "assessment.current-exit",
      title: "当前任务出口检查",
      kind: active?.assessment ?? "exit_ticket",
      status: active ? "ready" : "scheduled",
      target: active?.capabilityTitles.join("、") || "下一项能力",
      reason: active ? "完成后用一条可判断信号决定推进、回看或补前置。" : "等待下一周任务包生成。",
    },
    {
      id: "assessment.retest",
      title: "延迟复测",
      kind: "retest",
      status: current.knowledgeStates.some((item) => item.status === "confirmed") ? "scheduled" : "blocked",
      target: "已验证但需要保鲜的能力",
      reason: "已验证能力不永久点亮，后续应按复测窗口重新检查。",
    },
  ];
}

function buildArtifactGallery(
  current: CurrentLearningState,
  tasks: LearningOrchestrationState["weeklyPackage"] extends infer T
    ? T extends { tasks: infer U } ? U extends Array<infer V> ? V[] : never : never
    : never,
): LearningOrchestrationState["controlCenter"]["artifactGallery"] {
  const completed = tasks.filter((task) => task.status === "completed");
  if (completed.length === 0) {
    return [{
      id: "artifact.placeholder",
      title: "还没有可评审成果",
      state: "draft",
      proves: ["完成一次任务总结、场景判断或小产出后出现"],
      source: "学习反馈",
      nextAction: "先完成当前任务的出口检查。",
    }];
  }
  return completed.slice(-5).map((task) => ({
    id: `artifact.${task.id}`,
    title: `${task.title} · 学习信号`,
    state: "needs_review",
    proves: ["已完成任务；相关能力仍需成果与迁移验证", ...task.capabilityTitles],
    source: "学习反馈",
    nextAction: "在成长页查看它支持了哪些能力判断。",
  }));
}
