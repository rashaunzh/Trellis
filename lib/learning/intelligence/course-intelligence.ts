import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

export const sourceClassSchema = z.enum([
  "academic_standard",
  "academic_course",
  "official_curriculum",
  "official_documentation",
  "professional_reference",
  "market_training",
  "current_signal",
]);

export const sourcePurposeSchema = z.enum([
  "define_domain",
  "teach_systematically",
  "practice_reference",
  "tool_update",
  "current_signal",
]);

export const publicationStatusSchema = z.enum([
  "candidate",
  "validated",
  "published",
  "superseded",
  "failed",
]);

export const trustedSourceSchema = z.object({
  id: nonEmpty,
  title: nonEmpty,
  url: z.string().url(),
  sourceClass: sourceClassSchema,
  purposes: z.array(sourcePurposeSchema).min(1),
  provider: nonEmpty,
  status: publicationStatusSchema,
  notes: z.string().default(""),
});

export const domainNodeSchema = z.object({
  id: nonEmpty,
  categoryId: nonEmpty,
  title: nonEmpty,
  description: nonEmpty,
  outcomes: z.array(nonEmpty).min(1),
  targetDepth: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  confidence: z.number().min(0).max(1).default(1),
  prerequisiteNodeIds: z.array(nonEmpty).default([]),
  sourceCitations: z.array(z.lazy(() => sourceCitationSchema)).min(1),
});

export const domainGraphSchema = z.object({
  id: nonEmpty,
  version: nonEmpty,
  title: nonEmpty,
  status: publicationStatusSchema,
  categories: z.array(z.object({ id: nonEmpty, title: nonEmpty, description: nonEmpty })).min(1),
  nodes: z.array(domainNodeSchema).min(1),
  publishedAt: nonEmpty.optional(),
});

export const learningIntakeSchema = z.object({
  goal: nonEmpty.max(1200),
  weeklyCapacity: z.enum(["light", "steady", "focused", "intensive"]),
  materials: z.array(z.object({
    title: z.string().trim().max(200).default(""),
    url: z.string().trim().max(2000).default(""),
    outline: z.string().trim().max(30000).default(""),
  })).max(8).default([]),
});

export const curriculumRecordStatusSchema = z.enum(["draft", "confirmed", "superseded"]);

export const sourceCitationSchema = z.object({
  title: nonEmpty,
  url: z.string().url(),
  sourceClass: sourceClassSchema,
  retrievedAt: nonEmpty,
});

export const courseUnitSchema = z.object({
  id: nonEmpty,
  title: nonEmpty,
  order: z.number().int().nonnegative(),
  estimatedMinutes: z.number().int().positive().optional(),
  prerequisites: z.array(nonEmpty).default([]),
  learningOutcomes: z.array(nonEmpty).default([]),
  formats: z.array(z.enum(["video", "reading", "quiz", "lab", "project", "discussion"])).default([]),
});

export const courseGenomeSchema = z.object({
  schemaVersion: z.literal(1),
  id: nonEmpty,
  title: nonEmpty,
  provider: nonEmpty,
  url: z.string().url(),
  version: nonEmpty,
  level: z.enum(["introductory", "beginner", "intermediate", "advanced"]),
  audiences: z.array(nonEmpty).min(1),
  prerequisites: z.array(nonEmpty).default([]),
  learningOutcomes: z.array(nonEmpty).min(1),
  units: z.array(courseUnitSchema).min(1),
  sourceCitations: z.array(sourceCitationSchema).min(1),
});

export const unitNodeMappingSchema = z.object({
  courseId: nonEmpty,
  unitId: nonEmpty,
  nodeId: nonEmpty,
  depth: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  relation: z.enum(["core", "supporting", "context"]),
  confidence: z.number().min(0).max(1),
  sourceCitations: z.array(sourceCitationSchema).min(1),
});

export const courseDecisionSchema = z.object({
  courseId: nonEmpty,
  role: z.enum(["anchor", "selected_units", "supplement", "defer", "exclude"]),
  selectedUnitIds: z.array(nonEmpty).default([]),
  rationale: nonEmpty,
  confidence: z.number().min(0).max(1),
  exitCriteria: z.array(nonEmpty).default([]),
  sourceCitations: z.array(sourceCitationSchema).min(1),
});

export const curriculumStageSchema = z.object({
  id: nonEmpty,
  title: nonEmpty,
  objective: nonEmpty,
  unitRefs: z.array(z.object({ courseId: nonEmpty, unitId: nonEmpty })).min(1),
  exitCriteria: z.array(nonEmpty).min(1),
  anchorCourseId: nonEmpty.optional(),
  supplementCourseIds: z.array(nonEmpty).optional(),
  stopAfterUnitId: nonEmpty.optional(),
});

export const curriculumAssemblySchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  id: nonEmpty,
  learnerIntent: nonEmpty,
  targetNodeIds: z.array(nonEmpty).min(1),
  decisions: z.array(courseDecisionSchema).min(1),
  mappings: z.array(unitNodeMappingSchema).min(1),
  stages: z.array(curriculumStageSchema).min(1),
  unresolvedGaps: z.array(nonEmpty).default([]),
  rationale: nonEmpty,
  generatedAt: nonEmpty,
});

export type CourseGenome = z.infer<typeof courseGenomeSchema>;
export type CurriculumAssembly = z.infer<typeof curriculumAssemblySchema>;
export type UnitNodeMapping = z.infer<typeof unitNodeMappingSchema>;
export type TrustedSource = z.infer<typeof trustedSourceSchema>;
export type DomainGraph = z.infer<typeof domainGraphSchema>;
export type DomainNode = z.infer<typeof domainNodeSchema>;
export type LearningIntake = z.infer<typeof learningIntakeSchema>;
export type PublicationStatus = z.infer<typeof publicationStatusSchema>;

/** A complete, published catalog item. Runtime decisions must not reach back into seed data. */
export const publishedCourseSchema = z.object({
  genome: courseGenomeSchema,
  tags: z.array(nonEmpty).max(20),
  mappings: z.array(unitNodeMappingSchema).min(1),
});

export type PublishedCourse = z.infer<typeof publishedCourseSchema>;

export interface CourseCandidateRecord {
  id: string;
  ownerId: string;
  title: string;
  sourceUrl: string;
  outline: string[];
  analysisJson: string;
  candidateJson?: string;
  evalJson?: string;
  impactJson?: string;
  workflowRunId?: string | null;
  status: "candidate" | "validated" | "rejected" | "published";
  createdAt: string;
  updatedAt: string;
}

export function evaluatePublishedCourse(input: PublishedCourse, graph: DomainGraph): CourseIntelligenceEvalIssue[] {
  const course = publishedCourseSchema.parse(input);
  const issues: CourseIntelligenceEvalIssue[] = [];
  const unitIds = new Set(course.genome.units.map((unit) => unit.id));
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const mappedUnits = new Set<string>();
  for (const mapping of course.mappings) {
    if (mapping.courseId !== course.genome.id) {
      issues.push({ severity: "blocking", code: "mapping_course_mismatch", message: `映射课程 ${mapping.courseId} 与候选课程不一致。` });
    }
    if (!unitIds.has(mapping.unitId)) {
      issues.push({ severity: "blocking", code: "unknown_course_unit", message: `映射引用未知章节 ${mapping.unitId}。` });
    }
    if (!nodeIds.has(mapping.nodeId)) {
      issues.push({ severity: "blocking", code: "unknown_domain_node", message: `映射引用未发布节点 ${mapping.nodeId}。` });
    }
    if (mapping.confidence < 0.8) {
      issues.push({ severity: "blocking", code: "low_confidence_mapping", message: `${mapping.unitId} 的节点映射置信度不足。` });
    }
    mappedUnits.add(mapping.unitId);
  }
  for (const unit of course.genome.units) {
    if (!mappedUnits.has(unit.id)) {
      issues.push({ severity: "blocking", code: "unmapped_course_unit", message: `${unit.title} 尚未映射到领域节点。` });
    }
  }
  return issues;
}

export interface CurriculumRecord {
  id: string;
  ownerId: string;
  status: z.infer<typeof curriculumRecordStatusSchema>;
  activationStatus: "inactive" | "activating" | "active" | "failed";
  activationError: string;
  parentCurriculumId?: string | null;
  graphVersionId?: string;
  revision?: number;
  intake: LearningIntake;
  assembly: CurriculumAssembly;
  createdAt: string;
  updatedAt: string;
}

export const learningSignalInputSchema = z.object({
  type: z.enum(["understanding", "quiz_result", "stuck", "judgment"]),
  value: z.union([z.string().trim().min(1).max(1200), z.number().min(0).max(100), z.boolean()]),
  note: z.string().trim().max(1200).default(""),
});

export type LearningSignalInput = z.infer<typeof learningSignalInputSchema>;

export interface LearningSignal {
  id: string;
  ownerId: string;
  activityId: string;
  curriculumId: string;
  canonicalNodeId: string;
  type: LearningSignalInput["type"];
  value: LearningSignalInput["value"];
  note: string;
  createdAt: string;
}

export interface CanonicalKnowledgeState {
  ownerId: string;
  nodeId: string;
  status: "not_started" | "planned" | "learning" | "has_signal" | "confirmed";
  confidence: number;
  latestSignalId: string | null;
  updatedAt: string;
}

export interface CourseIntelligencePort {
  analyzeCatalog(input: { catalogUrl: string; learnerIntent: string }): Promise<CourseGenome[]>;
  assembleCurriculum(input: {
    learnerIntent: string;
    courses: CourseGenome[];
    targetNodeIds: string[];
  }): Promise<CurriculumAssembly>;
}

export interface CourseIntelligenceEvalIssue {
  severity: "blocking" | "warning";
  code: string;
  message: string;
}

export interface CourseIntelligenceEvalReport {
  passed: boolean;
  issues: CourseIntelligenceEvalIssue[];
  metrics: {
    targetCoverage: number;
    selectedCourseRatio: number;
    decisionTraceability: number;
    mappingTraceability: number;
  };
}

export interface CourseGenomeDiff {
  courseId: string;
  fromVersion: string;
  toVersion: string;
  addedUnitIds: string[];
  removedUnitIds: string[];
  changedUnitIds: string[];
  metadataChanged: boolean;
  requiresReview: boolean;
}

export function compareCourseGenomes(previousRaw: CourseGenome, nextRaw: CourseGenome): CourseGenomeDiff {
  const previous = courseGenomeSchema.parse(previousRaw);
  const next = courseGenomeSchema.parse(nextRaw);
  if (previous.id !== next.id) throw new Error("只能比较同一课程的不同版本。");
  const previousUnits = new Map(previous.units.map((unit) => [unit.id, unit]));
  const nextUnits = new Map(next.units.map((unit) => [unit.id, unit]));
  const addedUnitIds = next.units.filter((unit) => !previousUnits.has(unit.id)).map((unit) => unit.id);
  const removedUnitIds = previous.units.filter((unit) => !nextUnits.has(unit.id)).map((unit) => unit.id);
  const changedUnitIds = next.units
    .filter((unit) => {
      const before = previousUnits.get(unit.id);
      return before ? JSON.stringify(before) !== JSON.stringify(unit) : false;
    })
    .map((unit) => unit.id);
  const metadataChanged = JSON.stringify({
    title: previous.title,
    level: previous.level,
    audiences: previous.audiences,
    prerequisites: previous.prerequisites,
    learningOutcomes: previous.learningOutcomes,
  }) !== JSON.stringify({
    title: next.title,
    level: next.level,
    audiences: next.audiences,
    prerequisites: next.prerequisites,
    learningOutcomes: next.learningOutcomes,
  });
  return {
    courseId: previous.id,
    fromVersion: previous.version,
    toVersion: next.version,
    addedUnitIds,
    removedUnitIds,
    changedUnitIds,
    metadataChanged,
    requiresReview: metadataChanged || addedUnitIds.length > 0 || removedUnitIds.length > 0 || changedUnitIds.length > 0,
  };
}

export function evaluateDomainGraph(raw: DomainGraph): CourseIntelligenceEvalIssue[] {
  const graph = domainGraphSchema.parse(raw);
  const issues: CourseIntelligenceEvalIssue[] = [];
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  if (nodeIds.size !== graph.nodes.length) {
    issues.push({ severity: "blocking", code: "duplicate_domain_node", message: "领域图存在重复节点 ID。" });
  }
  for (const node of graph.nodes) {
    if (graph.status === "published" && node.confidence < 0.8) {
      issues.push({ severity: "blocking", code: "low_confidence_node", message: `${node.title} 置信度不足，不能进入发布图。` });
    }
    for (const prerequisite of node.prerequisiteNodeIds) {
      if (!nodeIds.has(prerequisite)) {
        issues.push({ severity: "blocking", code: "unknown_prerequisite", message: `${node.title} 引用了未知前置 ${prerequisite}。` });
      }
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const prerequisites = new Map(graph.nodes.map((node) => [node.id, node.prerequisiteNodeIds]));
  function visit(nodeId: string): boolean {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    const cyclic = (prerequisites.get(nodeId) ?? []).some((id) => nodeIds.has(id) && visit(id));
    visiting.delete(nodeId);
    visited.add(nodeId);
    return cyclic;
  }
  if (graph.nodes.some((node) => visit(node.id))) {
    issues.push({ severity: "blocking", code: "prerequisite_cycle", message: "领域图前置关系存在循环。" });
  }
  return issues;
}

export function evaluateCurriculumAssembly(input: {
  courses: CourseGenome[];
  assembly: CurriculumAssembly;
}): CourseIntelligenceEvalReport {
  const courses = input.courses.map((course) => courseGenomeSchema.parse(course));
  const assembly = curriculumAssemblySchema.parse(input.assembly);
  const issues: CourseIntelligenceEvalIssue[] = [];
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const decisionsByCourse = new Map(assembly.decisions.map((decision) => [decision.courseId, decision]));
  const activeRoles = new Set(["anchor", "selected_units", "supplement"]);
  const activeDecisions = assembly.decisions.filter((decision) => activeRoles.has(decision.role));

  if (decisionsByCourse.size !== assembly.decisions.length) {
    issues.push({ severity: "blocking", code: "duplicate_course_decision", message: "同一课程不能出现多个取舍结论。" });
  }
  if (assembly.schemaVersion === 1 && assembly.decisions.filter((decision) => decision.role === "anchor").length > 1) {
    issues.push({ severity: "blocking", code: "multiple_anchors", message: "一个阶段最多只能有一门主课。" });
  }
  if (activeDecisions.length === 0) {
    issues.push({ severity: "blocking", code: "no_active_course", message: "课程组合至少需要一门当前采用课程。" });
  }

  for (const decision of assembly.decisions) {
    const course = courseById.get(decision.courseId);
    if (!course) {
      issues.push({ severity: "blocking", code: "unknown_course", message: `取舍引用了未知课程 ${decision.courseId}。` });
      continue;
    }
    const unitIds = new Set(course.units.map((unit) => unit.id));
    for (const unitId of decision.selectedUnitIds) {
      if (!unitIds.has(unitId)) {
        issues.push({ severity: "blocking", code: "unknown_selected_unit", message: `${course.title} 引用了未知章节 ${unitId}。` });
      }
    }
    if (decision.role === "selected_units" && decision.selectedUnitIds.length === 0) {
      issues.push({ severity: "blocking", code: "missing_selected_units", message: `${course.title} 标记为局部采用但没有指定章节。` });
    }
    if (activeRoles.has(decision.role) && decision.exitCriteria.length === 0) {
      issues.push({ severity: "blocking", code: "missing_exit_criteria", message: `${course.title} 缺少退出条件。` });
    }
  }

  const mappingKeys = new Set<string>();
  for (const mapping of assembly.mappings) {
    const course = courseById.get(mapping.courseId);
    if (!course || !course.units.some((unit) => unit.id === mapping.unitId)) {
      issues.push({ severity: "blocking", code: "invalid_mapping_ref", message: `章节映射引用无效：${mapping.courseId}/${mapping.unitId}。` });
    }
    mappingKeys.add(`${mapping.courseId}/${mapping.unitId}`);
  }

  for (const stage of assembly.stages) {
    if (assembly.schemaVersion === 2 && stage.anchorCourseId
      && !stage.unitRefs.some((ref) => ref.courseId === stage.anchorCourseId)) {
      issues.push({ severity: "blocking", code: "stage_anchor_missing", message: `${stage.title} 的主线课程没有进入本阶段章节。` });
    }
    for (const ref of stage.unitRefs) {
      const decision = decisionsByCourse.get(ref.courseId);
      if (!decision || !activeRoles.has(decision.role)) {
        issues.push({ severity: "blocking", code: "inactive_stage_course", message: `${stage.title} 引用了未采用课程 ${ref.courseId}。` });
      }
      if (!mappingKeys.has(`${ref.courseId}/${ref.unitId}`)) {
        issues.push({ severity: "blocking", code: "unmapped_stage_unit", message: `${stage.title} 的章节 ${ref.unitId} 没有知识节点映射。` });
      }
    }
  }

  const coveredNodeIds = new Set(assembly.mappings.map((mapping) => mapping.nodeId));
  const targetCoverage = assembly.targetNodeIds.filter((nodeId) => coveredNodeIds.has(nodeId)).length / assembly.targetNodeIds.length;
  if (targetCoverage < 1 && assembly.unresolvedGaps.length === 0) {
    issues.push({ severity: "blocking", code: "undeclared_target_gap", message: "当前组合没有覆盖全部目标知识节点，也没有声明路线缺口。" });
  }

  const decisionTraceability = assembly.decisions.filter((decision) => decision.sourceCitations.length > 0).length / assembly.decisions.length;
  const mappingTraceability = assembly.mappings.filter((mapping) => mapping.sourceCitations.length > 0).length / assembly.mappings.length;

  return {
    passed: !issues.some((issue) => issue.severity === "blocking"),
    issues,
    metrics: {
      targetCoverage,
      selectedCourseRatio: activeDecisions.length / courses.length,
      decisionTraceability,
      mappingTraceability,
    },
  };
}
