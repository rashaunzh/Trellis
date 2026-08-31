import { z } from "zod";
import type { LearningActivity, NodeProgress, WeeklyPlan } from "../domain/types.ts";
import type { LearnerProfile, LearningStore } from "../persistence/store.ts";
import {
  curriculumAssemblySchema,
  evaluatePublishedCourse,
  evaluateCurriculumAssembly,
  learningIntakeSchema,
  learningSignalInputSchema,
  publishedCourseSchema,
  type CanonicalKnowledgeState,
  type CourseGenome,
  type CurriculumAssembly,
  type CurriculumRecord,
  type DomainGraph,
  type LearningIntake,
  type LearningSignal,
  type LearningSignalInput,
  type PublishedCourse,
} from "./course-intelligence.ts";
import { CourseIntelligenceModelGateway, type ModelGatewayStatus } from "./model-gateway.ts";
import type { CourseIntelligenceRepository } from "./repository.ts";

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
}

const intentRefinementSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  profile: z.enum(["literacy", "product", "builder"]),
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

const targetNodes: Record<IntentProfile, string[]> = {
  literacy: [
    "ai.scope", "ai.genai-llm", "ai.capability-boundary", "ai.responsible-use",
    "use.delegation", "use.description", "use.discernment", "use.diligence",
  ],
  product: [
    "ai.genai-llm", "ai.capability-boundary", "use.discernment", "pm.problem-framing",
    "pm.use-case-fit", "pm.capability-design", "pm.interaction-fallback", "pm.eval-design",
  ],
  builder: [
    "ai.genai-llm", "ai.capability-boundary", "app.prompting", "app.rag",
    "app.tools", "app.agents", "app.eval-observability", "app.security",
  ],
};

const preferredCourses: Record<IntentProfile, string[]> = {
  literacy: ["anthropic.ai-fluency", "ms.ai-concepts", "dlai.genai-for-everyone", "dlai.ai-for-everyone", "nist.ai-rmf"],
  product: ["anthropic.ai-fluency", "dlai.ai-for-everyone", "dlai.genai-for-everyone", "duke.ai-product", "book.ai-product-manager", "nist.ai-rmf", "langchain.langsmith", "dlai.agentic-ai"],
  builder: ["ms.ai-concepts", "dlai.prompt-engineering", "langchain.intro", "dlai.langchain-dev", "dlai.agentic-ai", "langchain.langsmith", "ms.genai-apps"],
};

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

function catalogProviderFor(material: LearningIntake["materials"][number]): string | null {
  try {
    const url = new URL(material.url);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const path = url.pathname.replace(/\/$/, "").toLowerCase();
    if (host === "deeplearning.ai" && (path === "/courses" || path === "/short-courses")) return "DeepLearning.AI";
    if (host === "learn.microsoft.com" && path.includes("/training")) return "Microsoft Learn";
    if (host === "academy.langchain.com") return "LangChain Academy";
    if (host === "anthropic.com" && path.includes("/learn")) return "Anthropic";
  } catch {
    return null;
  }
  return null;
}

function describeProfile(profile: IntentProfile): string {
  if (profile === "product") return "形成 AI 产品场景、能力边界、交互兜底与评测决策能力";
  if (profile === "builder") return "理解并实现生成式 AI 应用的核心系统能力";
  return "建立 AI 与生成式 AI 的共同基础，并形成可靠使用和辨别能力";
}

function buildAssembly(input: {
  intake: LearningIntake;
  courses: PublishedCourse[];
  graph: DomainGraph;
  profile: IntentProfile;
  interpretedGoal: string;
  targetNodeIds: string[];
}): CurriculumAssembly {
  const preferred = preferredCourses[input.profile];
  const courseRank = new Map(preferred.map((id, index) => [id, index]));
  const supplied = new Set(input.intake.materials.map((material) => matchingCourse(material, input.courses)?.genome.id).filter(Boolean));
  const catalogProviders = new Set(input.intake.materials.map(catalogProviderFor).filter((provider): provider is string => Boolean(provider)));
  const allMappings = input.courses.flatMap((course) => course.mappings);
  const selectedUnits = new Map<string, Set<string>>();

  for (const nodeId of input.targetNodeIds) {
    const mappedCandidates = allMappings.filter((mapping) => mapping.nodeId === nodeId);
    const scopedCandidates = catalogProviders.size > 0
      ? mappedCandidates.filter((mapping) => {
          const course = input.courses.find((item) => item.genome.id === mapping.courseId);
          return course ? catalogProviders.has(course.genome.provider) : false;
        })
      : mappedCandidates;
    const candidates = scopedCandidates
      .sort((a, b) => {
        const suppliedDelta = Number(supplied.has(b.courseId)) - Number(supplied.has(a.courseId));
        if (suppliedDelta) return suppliedDelta;
        return (courseRank.get(a.courseId) ?? 999) - (courseRank.get(b.courseId) ?? 999);
      });
    const chosen = candidates[0];
    if (!chosen) continue;
    const unitIds = selectedUnits.get(chosen.courseId) ?? new Set<string>();
    unitIds.add(chosen.unitId);
    selectedUnits.set(chosen.courseId, unitIds);
  }

  const activeCourseIds = Array.from(selectedUnits.keys()).sort((a, b) =>
    (courseRank.get(a) ?? 999) - (courseRank.get(b) ?? 999),
  );
  const activeSet = new Set(activeCourseIds);
  const anchorId = activeCourseIds[0];
  const decisions = input.courses.map((item) => {
    const units = Array.from(selectedUnits.get(item.genome.id) ?? []);
    const preferredIndex = courseRank.get(item.genome.id);
    const role = item.genome.id === anchorId
      ? "anchor" as const
      : activeSet.has(item.genome.id)
        ? "selected_units" as const
        : preferredIndex !== undefined
          ? "defer" as const
          : "exclude" as const;
    const selectedTitles = item.genome.units.filter((unit) => units.includes(unit.id)).map((unit) => unit.title);
    return {
      courseId: item.genome.id,
      role,
      selectedUnitIds: units,
      rationale: role === "anchor"
        ? `作为当前主线，优先承担：${selectedTitles.join("、")}。`
        : role === "selected_units"
          ? `只采用与目标直接相关的章节：${selectedTitles.join("、")}；其余内容暂不增加负担。`
          : role === "defer"
            ? "内容有价值，但不是当前阶段最短路径，保留为后续补充。"
            : item.tags.includes("ml-engineering")
              ? "偏模型训练与工程实现，当前目标没有证据表明需要把它作为前置。"
              : "与当前目标节点重合较少，本轮不纳入。",
      confidence: role === "exclude" ? 0.82 : 0.9,
      exitCriteria: activeSet.has(item.genome.id) ? [`能用自己的场景解释并应用所选章节，不要求完成整门课程`] : [],
      sourceCitations: item.genome.sourceCitations,
    };
  });

  const selectedRefs = activeCourseIds.flatMap((courseId) => {
    const genome = input.courses.find((item) => item.genome.id === courseId)!.genome;
    return genome.units
      .filter((unit) => selectedUnits.get(courseId)?.has(unit.id))
      .map((unit) => ({ courseId, unitId: unit.id }));
  });
  const mappingKey = new Set(selectedRefs.map((ref) => `${ref.courseId}/${ref.unitId}`));
  const mappings = allMappings.filter((mapping) => mappingKey.has(`${mapping.courseId}/${mapping.unitId}`));
  const nodeCategory = new Map(input.graph.nodes.map((node) => [node.id, node.categoryId]));
  const stageBuckets = new Map<string, typeof selectedRefs>();
  for (const ref of selectedRefs) {
    const primaryMapping = mappings.find((mapping) => mapping.courseId === ref.courseId && mapping.unitId === ref.unitId);
    const category = primaryMapping ? nodeCategory.get(primaryMapping.nodeId) ?? "foundation" : "foundation";
    const bucket = stageBuckets.get(category) ?? [];
    bucket.push(ref);
    stageBuckets.set(category, bucket);
  }
  const categoryById = new Map(input.graph.categories.map((category) => [category.id, category]));
  const stages = Array.from(stageBuckets.entries()).map(([categoryId, refs], index) => ({
    id: `stage.${index + 1}.${categoryId}`,
    title: categoryById.get(categoryId)?.title ?? "目标能力",
    objective: categoryById.get(categoryId)?.description ?? "形成目标所需判断。",
    unitRefs: refs,
    exitCriteria: [`能用一个真实场景说明这一阶段的关键判断，并指出仍不确定的部分`],
  }));
  const covered = new Set(mappings.map((mapping) => mapping.nodeId));
  const missingTargets = input.targetNodeIds.filter((nodeId) => !covered.has(nodeId));
  const profileGap = input.profile === "product"
    ? "真实用户研究、公司数据和业务约束需要在具体产品场景中补充"
    : input.profile === "builder"
      ? "具体框架与云平台实现需按最终技术栈补充"
      : "专业分支将在目标明确后展开，不在共同基础阶段提前堆叠";

  return curriculumAssemblySchema.parse({
    schemaVersion: 1,
    id: `curriculum.${crypto.randomUUID()}`,
    learnerIntent: input.interpretedGoal,
    targetNodeIds: input.targetNodeIds,
    decisions,
    mappings,
    stages,
    unresolvedGaps: [...missingTargets.map((nodeId) => `尚无可信课程覆盖：${nodeId}`), profileGap],
    rationale: catalogProviders.size > 0
      ? `优先在 ${Array.from(catalogProviders).join("、")} 的已发布目录中压缩出 ${activeCourseIds.length} 个当前采用来源；无法覆盖的目标保持为缺口，不由外部材料静默补齐。`
      : `从 ${input.courses.length} 个代表课程与参考中压缩出 ${activeCourseIds.length} 个当前采用来源；课程只承担其最合适的章节，不要求按平台目录完整通关。`,
    generatedAt: new Date().toISOString(),
  });
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
    await this.repository.saveCourseCandidate({
      id: candidateId,
      ownerId,
      title: candidate.title,
      sourceUrl: material.url,
      outline: lines,
      analysisJson: JSON.stringify(candidate),
      status: "candidate",
      createdAt: now,
      updatedAt: now,
    });
    return { status: "candidate", matchedCourse: null, extractedUnits: candidate.units.map((unit) => unit.title), message: "已保存候选课程结构，需完成节点映射和发布检查后才能进入正式路线。", modelUsed: true, candidateId };
  }

  async createCurriculum(ownerId: string, raw: unknown): Promise<CurriculumRecord> {
    const intake = learningIntakeSchema.parse(raw);
    const [courses, graph] = await Promise.all([this.repository.listCourses(), this.repository.getPublishedGraph()]);
    const fallbackProfile = inferProfile(intake.goal);
    const refined = await this.modelGateway.structured({
      ownerId,
      kind: "learning-intent",
      system: "解释学习目标并选择有限目标节点。profile 表示目标重心，不是让用户选择的专业分类。只能使用给定节点 ID。",
      data: { goal: intake.goal, availableNodes: graph.nodes.map((node) => ({ id: node.id, title: node.title })) },
      schema: intentRefinementSchema,
    });
    const validNodeIds = new Set(graph.nodes.map((node) => node.id));
    const profile = refined?.profile ?? fallbackProfile;
    const refinedTargets = refined?.targetNodeIds.filter((id) => validNodeIds.has(id)) ?? [];
    const chosenTargets = refinedTargets.length >= 4 ? refinedTargets : targetNodes[profile];
    const assembly = buildAssembly({
      intake,
      courses,
      graph,
      profile,
      interpretedGoal: refined?.summary ?? `${describeProfile(profile)}；用户原始目标：${intake.goal}`,
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
      intake,
      assembly,
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.saveCurriculum(record);
    await this.repository.supersedeCurricula(ownerId, record.id);
    return record;
  }

  async publishCourseCandidate(candidateId: string, raw: unknown): Promise<PublishedCourse> {
    const candidate = await this.repository.getCourseCandidate(candidateId);
    if (!candidate) throw Object.assign(new Error("课程候选不存在"), { status: 404 });
    const course = publishedCourseSchema.parse(raw);
    const graph = await this.repository.getPublishedGraph();
    const issues = evaluatePublishedCourse(course, graph);
    if (issues.length) {
      throw Object.assign(new Error(`课程候选未通过发布检查：${issues.map((issue) => issue.message).join("；")}`), { status: 409 });
    }
    await this.repository.publishCourseCandidate(candidateId, course);
    return course;
  }

  async getCurriculum(ownerId: string, id: string): Promise<CurriculumRecord | null> {
    return this.repository.getCurriculum(id, ownerId);
  }

  async getCurrentLearning(ownerId: string): Promise<CurrentLearningState> {
    const curriculum = await this.repository.getLatestCurriculum(ownerId);
    const knowledgeStates = await this.repository.listKnowledgeStates(ownerId);
    if (!this.learningStore || !curriculum || curriculum.status !== "confirmed") {
      return { curriculum, weeklyPlan: null, activities: [], knowledgeStates };
    }
    const profile = await this.learningStore.getProfile(ownerId);
    if (!profile) return { curriculum, weeklyPlan: null, activities: [], knowledgeStates };
    const weeklyPlan = await this.learningStore.getWeeklyPlanByWeek(ownerId, profile.activeRouteId, isoWeekKey(new Date()));
    const activities = weeklyPlan ? await this.learningStore.listActivitiesByPlan(weeklyPlan.id) : [];
    return { curriculum, weeklyPlan, activities, knowledgeStates };
  }

  async confirmCurriculum(ownerId: string, id: string): Promise<CurriculumRecord> {
    const record = await this.repository.getCurriculum(id, ownerId);
    if (!record) throw new Error("课程方案不存在");
    if (record.status !== "confirmed") {
      record.status = "confirmed";
      record.updatedAt = new Date().toISOString();
      await this.repository.saveCurriculum(record);
      await this.repository.supersedeCurricula(ownerId, record.id, true);
    }
    if (this.learningStore && record.activationStatus !== "active") {
      record.activationStatus = "activating";
      record.activationError = "";
      record.updatedAt = new Date().toISOString();
      await this.repository.saveCurriculum(record);
      try {
        await this.activateLearningRuntime(record);
        record.activationStatus = "active";
      } catch (error) {
        record.activationStatus = "failed";
        record.activationError = error instanceof Error ? error.message : "学习方案激活失败";
        await this.repository.saveCurriculum(record);
        throw error;
      }
      record.updatedAt = new Date().toISOString();
      await this.repository.saveCurriculum(record);
    }
    return record;
  }

  async recordLearningSignal(ownerId: string, activityId: string, raw: unknown): Promise<{ signal: LearningSignal; state: CanonicalKnowledgeState }> {
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
    const positive = input.type === "quiz_result"
      ? typeof input.value === "number" && input.value >= 70
      : input.type !== "stuck" && input.value !== false;
    const state: CanonicalKnowledgeState = {
      ownerId,
      nodeId: activity.canonicalNodeId,
      status: "has_signal",
      confidence: positive ? 2 : 1,
      latestSignalId: signal.id,
      updatedAt: now,
    };
    await this.repository.saveLearningSignal(signal, state);
    activity.status = "completed";
    await this.learningStore.saveActivity(activity);
    return { signal, state };
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
    await store.saveProfile(profile);
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
    await store.saveWeeklyPlan(plan);
    await store.clearOpenActivitiesForPlan(record.ownerId, plan.id);

    const courseById = new Map((await this.repository.listCourses()).map((item) => [item.genome.id, item.genome]));
    const refs = record.assembly.stages.flatMap((stage) => stage.unitRefs.map((ref) => ({ ...ref, stage })));
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
      await store.saveActivity(activity);
      const existingProgress = await store.getNodeProgress(record.ownerId, nodeId);
      if (!existingProgress) {
        const progress: NodeProgress = {
          id: `progress.ci.${crypto.randomUUID()}`, ownerId: record.ownerId, nodeId, status: "unstarted", confidence: 0,
          lastValidatedAt: null, supportingEvidenceIds: [], confirmedAt: null, reviewIntervalDays: 14, nextReviewAt: null, reviewCount: 0,
        };
        await store.saveNodeProgress(progress);
      }
      committed += estimatedMinutes;
      sequence += 1;
    }
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
