import { z } from "zod";
import type { LearningActivity, NodeProgress, WeeklyPlan } from "../domain/types.ts";
import type { LearnerProfile, LearningStore } from "../persistence/store.ts";
import {
  evaluatePublishedCourse,
  evaluateCurriculumAssembly,
  learningIntakeSchema,
  learningSignalInputSchema,
  publishedCourseSchema,
  type CanonicalKnowledgeState,
  type CourseGenome,
  type CurriculumRecord,
  type DomainGraph,
  type LearningIntake,
  type LearningSignal,
  type LearningSignalInput,
  type PublishedCourse,
} from "./course-intelligence.ts";
import { CourseIntelligenceModelGateway, hashInput, type ModelGatewayStatus } from "./model-gateway.ts";
import type { CourseIntelligenceRepository, WorkflowRunRecord } from "./repository.ts";
import { fetchPublicSource } from "./source-fetcher.ts";
import { deriveTargetNodeIds, solveCurriculum } from "./curriculum-solver.ts";
import { interpretLearningSignal, transitionDecision, type DecisionRecord, type LearningInterpretation } from "./decision-kernel.ts";

const capacityMinutes = { light: 120, steady: 240, focused: 360, intensive: 540 } as const;

type IntentProfile = "literacy" | "product" | "builder";

export interface MaterialAnalysisResult {
  status: "published" | "candidate" | "needs_analysis";
  matchedCourse: CourseGenome | null;
  extractedUnits: string[];
  message: string;
  modelUsed: boolean;
  candidateId: string | null;
}

export interface CourseIntelligenceState {
  catalogCount: number;
  catalog: CourseGenome[];
  sourceCount: number;
  model: ModelGatewayStatus;
  graph: DomainGraph;
  curriculum: CurriculumRecord | null;
}

export interface CurrentLearningState {
  curriculum: CurriculumRecord | null;
  weeklyPlan: WeeklyPlan | null;
  activities: LearningActivity[];
  knowledgeStates: CanonicalKnowledgeState[];
  workflow: WorkflowRunRecord | null;
  pendingDecisions: DecisionRecord[];
}

const intentRefinementSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  targetNodeIds: z.array(z.string()).min(1).max(14),
  outOfScope: z.array(z.string()).max(8).default([]),
});

const materialCandidateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  level: z.enum(["introductory", "beginner", "intermediate", "advanced"]),
  audiences: z.array(z.string().trim().min(1)).min(1).max(8),
  prerequisites: z.array(z.string().trim().min(1)).max(12),
  units: z.array(z.object({ title: z.string().trim().min(1).max(200) })).min(1).max(80),
});

function inferProfile(goal: string): IntentProfile {
  const normalized = goal.toLowerCase();
  if (/产品|product|pm|prd|用户价值|业务|场景|决策/.test(normalized)) return "product";
  if (/开发|编程|代码|build|developer|工程|rag|agent|应用实现|部署/.test(normalized)) return "builder";
  return "literacy";
}

function routeFor(profile: IntentProfile): string {
  return profile === "product" ? "ai-product" : profile === "builder" ? "ai-app-dev" : "ai-literacy";
}

function bridgeNode(nodeId: string): string {
  if (nodeId.startsWith("pm.problem") || nodeId === "pm.use-case-fit") return "ai-product.problem-def";
  if (nodeId.startsWith("pm.")) return nodeId.includes("eval") || nodeId.includes("metric") || nodeId.includes("failure")
    ? "ai-product.eval-decision"
    : "ai-product.capability-design";
  if (nodeId === "app.rag") return "ai-app-dev.rag";
  if (nodeId === "app.tools" || nodeId === "app.agents" || nodeId === "app.context-memory") return "ai-app-dev.tools";
  if (nodeId.startsWith("app.eval")) return "ai-app-dev.eval-harness";
  if (nodeId.startsWith("app.")) return "ai-app-dev.prompting";
  if (nodeId === "ai.responsible-use" || nodeId === "use.diligence") return "ai-literacy.responsibility";
  if (nodeId.includes("eval")) return "ai-literacy.evaluation";
  if (nodeId.startsWith("ml.") || nodeId === "ai.neural-networks") return "ai-literacy.fit";
  return "ai-literacy.mechanism";
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function matchingCourse(material: LearningIntake["materials"][number], courses: PublishedCourse[]): PublishedCourse | null {
  const url = normalizeUrl(material.url);
  const title = material.title.trim().toLowerCase();
  return courses.find((item) =>
    (url && normalizeUrl(item.genome.url) === url)
    || (title.length >= 5 && item.genome.title.toLowerCase().includes(title))
    || (title.length >= 5 && title.includes(item.genome.title.toLowerCase())),
  ) ?? null;
}

function providerFromUrl(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "用户提供材料";
  }
}

function bestCandidateNode(title: string, graph: DomainGraph): string {
  const terms = title.toLowerCase().split(/[\s、，：:()（）/\-_]+/).filter((term) => term.length > 1);
  const ranked = graph.nodes.map((node) => {
    const haystack = `${node.title} ${node.description} ${node.outcomes.join(" ")}`.toLowerCase();
    const score = terms.reduce((sum, term) => sum + Number(haystack.includes(term)), 0);
    return { id: node.id, score };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return ranked[0]?.id ?? graph.nodes[0]!.id;
}

export class CourseIntelligenceService {
  private repository: CourseIntelligenceRepository;
  private modelGateway: CourseIntelligenceModelGateway;
  private learningStore?: LearningStore;

  constructor(
    repository: CourseIntelligenceRepository,
    modelGateway: CourseIntelligenceModelGateway,
    learningStore?: LearningStore,
  ) {
    this.repository = repository;
    this.modelGateway = modelGateway;
    this.learningStore = learningStore;
  }

  async initialize(): Promise<void> {
    await this.repository.seedPublishedBaseline();
  }

  async getState(ownerId: string): Promise<CourseIntelligenceState> {
    const [sources, courses, graph, curriculum] = await Promise.all([
      this.repository.listSources(), this.repository.listCourses(), this.repository.getPublishedGraph(), this.repository.getLatestCurriculum(ownerId),
    ]);
    return { catalogCount: courses.length, catalog: courses.map((item) => item.genome), sourceCount: sources.length, model: this.modelGateway.status(), graph, curriculum };
  }

  async resetCurrentLearning(ownerId: string): Promise<CurrentLearningState> {
    await this.repository.resetOwnerState(ownerId);
    if (this.learningStore) await this.learningStore.resetLearner(ownerId);
    return this.getCurrentLearning(ownerId);
  }

  async analyzeMaterial(ownerId: string, raw: unknown): Promise<MaterialAnalysisResult> {
    const intake = learningIntakeSchema.parse({ goal: "评估用户材料", weeklyCapacity: "light", materials: [raw] });
    const material = intake.materials[0]!;
    const courses = await this.repository.listCourses();
    const matched = matchingCourse(material, courses);
    if (matched) {
      return { status: "published", matchedCourse: matched.genome, extractedUnits: matched.genome.units.map((unit) => unit.title), message: "已匹配发布课程版本，可进入课程取舍。", modelUsed: false, candidateId: null };
    }
    const lines = material.outline.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 80);
    if (lines.length === 0) {
      return { status: "needs_analysis", matchedCourse: null, extractedUnits: [], message: "没有可解析的公开目录。请粘贴课程目录或摘要。", modelUsed: false, candidateId: null };
    }
    const candidate = await this.modelGateway.structured({
      ownerId,
      kind: "material-outline",
      system: "从课程目录中识别课程标题、难度、受众、前置和章节。不要补写目录中没有的信息。",
      data: { title: material.title, url: material.url, outline: lines },
      schema: materialCandidateSchema,
    });
    if (!candidate) {
      return { status: "needs_analysis", matchedCourse: null, extractedUnits: lines, message: "已保留目录，但当前没有可用内置模型，不能把标题切行冒充专业课程分析。", modelUsed: false, candidateId: null };
    }
    const now = new Date().toISOString();
    const candidateId = `candidate.${crypto.randomUUID()}`;
    const graph = await this.repository.getPublishedGraph();
    const courseId = `candidate-course.${(await hashInput({ url: material.url, title: candidate.title })).slice(0, 16)}`;
    const sourceUrl = material.url || `https://trellis.invalid/material/${encodeURIComponent(candidateId)}`;
    const citation = {
      title: candidate.title,
      url: sourceUrl,
      sourceClass: "current_signal" as const,
      retrievedAt: now,
    };
    const units = candidate.units.map((unit, index) => ({
      id: `${courseId}.unit.${index + 1}`,
      title: unit.title,
      order: index,
      prerequisites: [],
      learningOutcomes: [unit.title],
      formats: [] as Array<"video" | "reading" | "quiz" | "lab" | "project" | "discussion">,
    }));
    const mappings = units.map((unit) => ({
      courseId,
      unitId: unit.id,
      nodeId: bestCandidateNode(unit.title, graph),
      depth: candidate.level === "advanced" ? 3 as const : candidate.level === "intermediate" ? 2 as const : 1 as const,
      relation: "core" as const,
      confidence: 0.6,
      sourceCitations: [citation],
    }));
    const candidateCourse: PublishedCourse = {
      genome: {
        schemaVersion: 1,
        id: courseId,
        title: candidate.title,
        provider: providerFromUrl(sourceUrl),
        url: sourceUrl,
        version: now.slice(0, 10),
        level: candidate.level,
        audiences: candidate.audiences,
        prerequisites: candidate.prerequisites,
        learningOutcomes: units.map((unit) => unit.title),
        units,
        sourceCitations: [citation],
      },
      tags: ["candidate"],
      mappings,
    };
    const evalIssues = evaluatePublishedCourse(candidateCourse, graph);
    await this.repository.saveCourseCandidate({
      id: candidateId,
      ownerId,
      title: candidate.title,
      sourceUrl: material.url,
      outline: lines,
      analysisJson: JSON.stringify(candidate),
      candidateJson: JSON.stringify(candidateCourse),
      evalJson: JSON.stringify({ passed: evalIssues.length === 0, issues: evalIssues }),
      impactJson: JSON.stringify({ affectedCurricula: [], reason: "new-course-candidate" }),
      workflowRunId: null,
      status: "candidate",
      createdAt: now,
      updatedAt: now,
    });
    return { status: "candidate", matchedCourse: null, extractedUnits: candidate.units.map((unit) => unit.title), message: "已保存候选课程结构，需完成节点映射和发布检查后才能进入正式路线。", modelUsed: true, candidateId };
  }

  async createCurriculum(ownerId: string, raw: unknown): Promise<CurriculumRecord> {
    const intake = learningIntakeSchema.parse(raw);
    const [courses, graph, previous] = await Promise.all([
      this.repository.listCourses(), this.repository.getPublishedGraph(), this.repository.getLatestCurriculum(ownerId),
    ]);
    const refined = await this.modelGateway.structured({
      ownerId,
      kind: "learning-intent",
      system: "解释学习目标并提出有限目标节点。只能使用给定节点 ID，不得选择与目标无关的机器学习工程前置。",
      data: { goal: intake.goal, availableNodes: graph.nodes.map((node) => ({ id: node.id, title: node.title })) },
      schema: intentRefinementSchema,
    });
    const chosenTargets = deriveTargetNodeIds(intake.goal, graph, refined?.targetNodeIds ?? []);
    const assembly = solveCurriculum({
      intake,
      courses,
      graph,
      interpretedGoal: refined?.summary ?? `用户希望获得的能力：${intake.goal}`,
      targetNodeIds: chosenTargets,
    });
    const evalReport = evaluateCurriculumAssembly({ courses: courses.map((item) => item.genome), assembly });
    if (!evalReport.passed) throw new Error(`课程组合未通过发布检查：${evalReport.issues.map((issue) => issue.message).join("；")}`);
    const now = new Date().toISOString();
    const record: CurriculumRecord = {
      id: assembly.id,
      ownerId,
      status: "draft",
      activationStatus: "inactive",
      activationError: "",
      parentCurriculumId: previous?.id ?? null,
      graphVersionId: graph.id,
      revision: (previous?.revision ?? 0) + 1,
      intake,
      assembly,
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.saveCurriculum(record);
    await this.repository.supersedeCurricula(ownerId, record.id);
    return record;
  }

  async publishCourseCandidate(candidateId: string, raw: unknown, reviewerOwnerId = "system"): Promise<PublishedCourse> {
    const candidate = await this.repository.getCourseCandidate(candidateId);
    if (!candidate) throw Object.assign(new Error("课程候选不存在"), { status: 404 });
    if (candidate.status !== "validated") {
      throw Object.assign(new Error("课程候选必须先通过内部评审才能发布"), { status: 409 });
    }
    const course = publishedCourseSchema.parse(raw ?? JSON.parse(candidate.candidateJson || "null"));
    const graph = await this.repository.getPublishedGraph();
    const issues = evaluatePublishedCourse(course, graph);
    if (issues.length) {
      throw Object.assign(new Error(`课程候选未通过发布检查：${issues.map((issue) => issue.message).join("；")}`), { status: 409 });
    }
    const now = new Date().toISOString();
    await this.repository.publishCourseCandidate(candidateId, course, {
      id: `candidate-review.${crypto.randomUUID()}`,
      candidateId,
      reviewerOwnerId,
      decision: "published",
      reason: "课程结构和全部章节映射通过发布质量闸门",
      reviewJson: JSON.stringify({ courseId: course.genome.id, version: course.genome.version }),
      createdAt: now,
    });
    const affected = await this.repository.listCurriculaUsingCourse(course.genome.id);
    for (const curriculum of affected) {
      const decision: DecisionRecord = {
        id: `decision.${crypto.randomUUID()}`, ownerId: curriculum.ownerId,
        decisionType: "route_migration", aggregateType: "curriculum", aggregateId: curriculum.id,
        workflowRunId: candidate.workflowRunId ?? null, riskLevel: "high", status: "proposed",
        inputHash: await hashInput({ curriculumId: curriculum.id, courseId: course.genome.id, version: course.genome.version }),
        proposal: { courseId: course.genome.id, newVersion: course.genome.version, keepCurrentUntilAccepted: true },
        rationale: { summary: "课程发布了新版本；当前路线继续使用原版本，是否迁移由用户确认。" },
        citations: course.genome.sourceCitations, confidence: 1,
        evalReport: { historyPreserved: true }, modelRoute: { mode: "version-impact" },
        createdAt: now, updatedAt: now, appliedAt: null,
      };
      await this.repository.saveDecision(decision, {
        id: `decision-event.${crypto.randomUUID()}`, decisionId: decision.id, fromStatus: null,
        toStatus: "proposed", actorType: "system", actorOwnerId: curriculum.ownerId,
        detail: { candidateId }, createdAt: now,
      });
    }
    return course;
  }

  async listCourseCandidates(status?: "candidate" | "validated" | "rejected" | "published") {
    return this.repository.listCourseCandidates(status);
  }

  async updateCourseCandidateDraft(candidateId: string, raw: unknown) {
    const candidate = await this.repository.getCourseCandidate(candidateId);
    if (!candidate) throw Object.assign(new Error("课程候选不存在"), { status: 404 });
    if (!["candidate", "validated"].includes(candidate.status)) {
      throw Object.assign(new Error("该课程候选当前不可编辑"), { status: 409 });
    }
    const course = publishedCourseSchema.parse(raw);
    const graph = await this.repository.getPublishedGraph();
    const issues = evaluatePublishedCourse(course, graph);
    const updated = {
      ...candidate,
      candidateJson: JSON.stringify(course),
      evalJson: JSON.stringify({ passed: issues.length === 0, issues }),
      status: "candidate" as const,
      updatedAt: new Date().toISOString(),
    };
    await this.repository.saveCourseCandidate(updated);
    return updated;
  }

  async refreshSource(sourceId: string) {
    const source = (await this.repository.listSources()).find((item) => item.id === sourceId);
    if (!source) throw Object.assign(new Error("课程来源不存在"), { status: 404 });
    try {
      const snapshot = await fetchPublicSource(source.url);
      const contentHash = await hashInput(snapshot.body);
      return this.repository.saveSourceUpdateCandidate({
        id: `snapshot.${sourceId}.${contentHash.slice(0, 16)}`,
        sourceId,
        contentHash,
        retrievedAt: snapshot.retrievedAt,
        contentJson: JSON.stringify({
          finalUrl: snapshot.finalUrl,
          contentType: snapshot.contentType,
          byteLength: new TextEncoder().encode(snapshot.body).byteLength,
        }),
      });
    } catch (error) {
      const checkedAt = new Date().toISOString();
      await this.repository.markSourceCheckFailed(
        sourceId,
        error instanceof Error ? error.message : "来源检查失败",
        checkedAt,
      );
      throw error;
    }
  }

  async reviewCourseCandidate(input: {
    candidateId: string;
    reviewerOwnerId: string;
    decision: "validated" | "rejected";
    reason: string;
  }) {
    const candidate = await this.repository.getCourseCandidate(input.candidateId);
    if (!candidate) throw Object.assign(new Error("课程候选不存在"), { status: 404 });
    if (!["candidate", "validated"].includes(candidate.status)) {
      throw Object.assign(new Error("该课程候选当前不可评审"), { status: 409 });
    }
    if (input.decision === "validated") {
      const evalReport = JSON.parse(candidate.evalJson || "{}") as { passed?: boolean; issues?: unknown[] };
      if (!candidate.candidateJson || evalReport.passed !== true) {
        throw Object.assign(new Error("课程候选仍有阻断问题，需先修正章节映射和置信度。"), { status: 409 });
      }
    }
    const reason = z.string().trim().min(3).max(1200).parse(input.reason);
    await this.repository.reviewCourseCandidate(input.candidateId, {
      id: `candidate-review.${crypto.randomUUID()}`,
      candidateId: input.candidateId,
      reviewerOwnerId: input.reviewerOwnerId,
      decision: input.decision,
      reason,
      reviewJson: JSON.stringify({ previousStatus: candidate.status }),
      createdAt: new Date().toISOString(),
    });
    return this.repository.getCourseCandidate(input.candidateId);
  }

  async getCurriculum(ownerId: string, id: string): Promise<CurriculumRecord | null> {
    return this.repository.getCurriculum(id, ownerId);
  }

  async getDecision(ownerId: string, id: string): Promise<DecisionRecord | null> {
    return this.repository.getDecision(id, ownerId);
  }

  async rejectDecision(ownerId: string, id: string): Promise<DecisionRecord> {
    const decision = await this.repository.getDecision(id, ownerId);
    if (!decision) throw Object.assign(new Error("决策不存在"), { status: 404 });
    const changed = transitionDecision({ decision, toStatus: "rejected", actorType: "user", actorOwnerId: ownerId });
    await this.repository.saveDecision(changed.decision, changed.event);
    return changed.decision;
  }

  async acceptDecision(ownerId: string, id: string): Promise<DecisionRecord> {
    const decision = await this.repository.getDecision(id, ownerId);
    if (!decision) throw Object.assign(new Error("决策不存在"), { status: 404 });
    const changed = transitionDecision({ decision, toStatus: "accepted", actorType: "user", actorOwnerId: ownerId });
    await this.repository.saveDecision(changed.decision, changed.event);
    return changed.decision;
  }

  async applyDecision(ownerId: string, id: string, detail: Record<string, unknown> = {}): Promise<DecisionRecord> {
    const decision = await this.repository.getDecision(id, ownerId);
    if (!decision) throw Object.assign(new Error("决策不存在"), { status: 404 });
    const changed = transitionDecision({ decision, toStatus: "applied", actorType: "workflow", actorOwnerId: ownerId, detail });
    await this.repository.saveDecision(changed.decision, changed.event);
    return changed.decision;
  }

  async getWorkflow(ownerId: string, id: string): Promise<WorkflowRunRecord | null> {
    return this.repository.getWorkflowRun(id, ownerId);
  }

  async getCurrentLearning(ownerId: string): Promise<CurrentLearningState> {
    const curriculum = await this.repository.getLatestCurriculum(ownerId);
    const knowledgeStates = await this.repository.listKnowledgeStates(ownerId);
    const workflow = curriculum
      ? await this.repository.getWorkflowRunByAggregate(ownerId, curriculum.id)
      : null;
    const pendingDecisions = await this.repository.listDecisions(ownerId, ["proposed", "needs_review", "accepted"]);
    if (!this.learningStore || !curriculum || curriculum.status !== "confirmed") {
      return { curriculum, weeklyPlan: null, activities: [], knowledgeStates, workflow, pendingDecisions };
    }
    const profile = await this.learningStore.getProfile(ownerId);
    if (!profile) return { curriculum, weeklyPlan: null, activities: [], knowledgeStates, workflow, pendingDecisions };
    const weeklyPlan = await this.learningStore.getWeeklyPlanByWeek(ownerId, profile.activeRouteId, isoWeekKey(new Date()));
    const activities = weeklyPlan ? await this.learningStore.listActivitiesByPlan(weeklyPlan.id) : [];
    return { curriculum, weeklyPlan, activities, knowledgeStates, workflow, pendingDecisions };
  }

  async confirmCurriculum(ownerId: string, id: string): Promise<CurriculumRecord> {
    const record = await this.repository.getCurriculum(id, ownerId);
    if (!record) throw new Error("课程方案不存在");
    if (record.activationStatus === "active") return record;
    if (!this.learningStore) {
      record.status = "confirmed";
      record.updatedAt = new Date().toISOString();
      await this.repository.saveCurriculum(record);
      await this.repository.supersedeCurricula(ownerId, record.id, true);
      return record;
    }

    record.activationStatus = "activating";
    record.activationError = "";
    try {
      await this.activateLearningRuntime(record);
      record.status = "confirmed";
      record.activationStatus = "active";
      record.updatedAt = new Date().toISOString();
      await this.repository.saveCurriculum(record);
      await this.repository.supersedeCurricula(ownerId, record.id, true);
    } catch (error) {
      record.activationStatus = "failed";
      record.activationError = error instanceof Error ? error.message : "学习方案激活失败";
      record.updatedAt = new Date().toISOString();
      await this.repository.saveCurriculum(record);
      throw error;
    }
    return record;
  }

  async recordLearningSignal(ownerId: string, activityId: string, raw: unknown): Promise<{
    signal: LearningSignal;
    state: CanonicalKnowledgeState;
    interpretation: LearningInterpretation;
    decision: DecisionRecord;
    nextAction: string;
  }> {
    if (!this.learningStore) throw new Error("学习运行时不可用");
    const input: LearningSignalInput = learningSignalInputSchema.parse(raw);
    const activity = await this.learningStore.getActivity(activityId);
    if (!activity || activity.ownerId !== ownerId) throw Object.assign(new Error("学习行动不存在"), { status: 404 });
    if (!activity.curriculumId || !activity.canonicalNodeId) {
      throw Object.assign(new Error("该历史行动尚未迁移到新版学习运行时"), { status: 409 });
    }
    const now = new Date().toISOString();
    const signal: LearningSignal = {
      id: `signal.${crypto.randomUUID()}`,
      ownerId,
      activityId,
      curriculumId: activity.curriculumId,
      canonicalNodeId: activity.canonicalNodeId,
      type: input.type,
      value: input.value,
      note: input.note,
      createdAt: now,
    };
    const interpretation = interpretLearningSignal(input);
    const state: CanonicalKnowledgeState = {
      ownerId,
      nodeId: activity.canonicalNodeId,
      status: interpretation.keepsActivityOpen ? "learning" : "has_signal",
      confidence: interpretation.outcome === "advance" ? 2 : 1,
      latestSignalId: signal.id,
      updatedAt: now,
    };
    await this.repository.saveLearningSignal(signal, state);
    activity.status = interpretation.keepsActivityOpen ? "in_progress" : "completed";
    await this.learningStore.saveActivity(activity);
    let decision: DecisionRecord = {
      id: `decision.${crypto.randomUUID()}`,
      ownerId,
      decisionType: "learning_adaptation",
      aggregateType: "learning_activity",
      aggregateId: activity.id,
      workflowRunId: null,
      riskLevel: interpretation.riskLevel,
      status: "generated",
      inputHash: await hashInput({ signalType: signal.type, value: signal.value, note: signal.note, activityId }),
      proposal: { outcome: interpretation.outcome, keepsActivityOpen: interpretation.keepsActivityOpen },
      rationale: { summary: interpretation.rationale },
      citations: [],
      confidence: interpretation.confidence,
      evalReport: { valid: true },
      modelRoute: { mode: "deterministic" },
      createdAt: now,
      updatedAt: now,
      appliedAt: null,
    };
    await this.repository.saveDecision(decision, {
      id: `decision-event.${crypto.randomUUID()}`, decisionId: decision.id, fromStatus: null,
      toStatus: "generated", actorType: "system", actorOwnerId: ownerId,
      detail: { signalId: signal.id }, createdAt: now,
    });
    let transition = transitionDecision({ decision, toStatus: "proposed", actorType: "workflow", actorOwnerId: ownerId });
    decision = transition.decision;
    await this.repository.saveDecision(decision, transition.event);
    if (interpretation.riskLevel === "low") {
      transition = transitionDecision({ decision, toStatus: "accepted", actorType: "system", detail: { policy: "low-risk-auto" } });
      decision = transition.decision;
      await this.repository.saveDecision(decision, transition.event);
      transition = transitionDecision({ decision, toStatus: "applied", actorType: "workflow" });
      decision = transition.decision;
      await this.repository.saveDecision(decision, transition.event);
    }
    const nextAction = interpretation.outcome === "advance"
      ? "继续已确认路线中的下一准确章节。"
      : interpretation.outcome === "repair_prerequisite"
        ? "先补当前节点的必要前置，再返回这一节。"
        : interpretation.outcome === "reduce_scope"
          ? "把当前范围缩小到一个概念或一个示例。"
          : interpretation.outcome === "replan"
            ? "查看并确认路线调整提案。"
            : "回看当前章节并补一个更具体的判断。";
    return { signal, state, interpretation, decision, nextAction };
  }

  private async activateLearningRuntime(record: CurriculumRecord): Promise<void> {
    const store = this.learningStore!;
    const profileKind = inferProfile(record.intake.goal);
    const routeId = routeFor(profileKind);
    const minutes = capacityMinutes[record.intake.weeklyCapacity];
    const existingProfile = await store.getProfile(record.ownerId);
    const profile: LearnerProfile = {
      id: existingProfile?.id ?? `profile.ci.${crypto.randomUUID()}`,
      ownerId: record.ownerId,
      goal: record.assembly.learnerIntent,
      activeRouteId: routeId,
      weeklyMinutes: minutes,
      status: "confirmed",
    };
    const weekKey = isoWeekKey(new Date());
    const existingPlan = await store.getWeeklyPlanByWeek(record.ownerId, routeId, weekKey);
    const plan: WeeklyPlan = existingPlan ?? {
      id: `plan.ci.${crypto.randomUUID()}`,
      ownerId: record.ownerId,
      routeId,
      weekKey,
      capacityMinutes: minutes,
      status: "confirmed",
      rationale: record.assembly.rationale,
    };
    plan.capacityMinutes = minutes;
    plan.rationale = record.assembly.rationale;

    const courseById = new Map((await this.repository.listCourses()).map((item) => [item.genome.id, item.genome]));
    const refs = record.assembly.stages.flatMap((stage) => stage.unitRefs.map((ref) => ({ ...ref, stage })));
    const activities: LearningActivity[] = [];
    const progressEntries: NodeProgress[] = [];
    let committed = 0;
    let sequence = 1;
    for (const ref of refs) {
      if (committed >= minutes) break;
      const course = courseById.get(ref.courseId);
      const unit = course?.units.find((candidate) => candidate.id === ref.unitId);
      if (!course || !unit) continue;
      const mapping = record.assembly.mappings.find((candidate) => candidate.courseId === ref.courseId && candidate.unitId === ref.unitId);
      const estimatedMinutes = Math.min(90, Math.max(30, Math.round((unit.estimatedMinutes ?? 45) / 15) * 15));
      const nodeId = bridgeNode(mapping?.nodeId ?? "ai.scope");
      const canonicalNodeId = mapping?.nodeId ?? "ai.scope";
      const activity: LearningActivity = {
        id: `activity.ci.${crypto.randomUUID()}`,
        ownerId: record.ownerId,
        weeklyPlanId: plan.id,
        nodeId,
        curriculumId: record.id,
        courseVersionId: `${course.id}@${course.version}`,
        courseId: course.id,
        unitId: unit.id,
        canonicalNodeId,
        title: `${course.title} · ${unit.title}`,
        activityType: unit.formats.includes("quiz") ? "quiz" : "follow_demo",
        goal: ref.stage.objective,
        estimatedMinutes,
        isCore: true,
        status: "planned",
        isSkipValidation: false,
        inputRefs: [course.id],
        steps: `打开课程并只完成“${unit.title}”。先不扩展到课程其他章节；达到退出条件即可停止。`,
        expectedEvidence: "选择当前理解状态；可填写课程随堂测试结果，或用一句话说明关键判断。",
        evaluationCriteria: ref.stage.exitCriteria.join("；"),
        nextAdvice: `退出条件：${ref.stage.exitCriteria.join("；")}`,
        sequence,
      };
      activities.push(activity);
      const existingProgress = await store.getNodeProgress(record.ownerId, nodeId);
      if (!existingProgress) {
        const progress: NodeProgress = {
          id: `progress.ci.${crypto.randomUUID()}`, ownerId: record.ownerId, nodeId, status: "unstarted", confidence: 0,
          lastValidatedAt: null, supportingEvidenceIds: [], confirmedAt: null, reviewIntervalDays: 14, nextReviewAt: null, reviewCount: 0,
        };
        progressEntries.push(progress);
      }
      committed += estimatedMinutes;
      sequence += 1;
    }
    await store.activateCurriculumRuntime({
      curriculumId: record.id,
      ownerId: record.ownerId,
      profile,
      weeklyPlan: plan,
      activities,
      nodeProgress: progressEntries,
    });
  }
}

function isoWeekKey(date: Date): string {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
