import type {
  CurriculumAssembly,
  CurriculumConstraint,
  DomainGraph,
  LearningIntake,
  PublishedCourse,
  UnitNodeMapping,
} from "./course-intelligence.ts";

const goalAliases: Array<{ pattern: RegExp; nodes: string[] }> = [
  { pattern: /产品|product|pm|prd|用户价值|业务|场景/, nodes: ["pm.problem-framing", "pm.use-case-fit", "pm.capability-design"] },
  { pattern: /评测|评估|eval|可靠|失败/, nodes: ["pm.eval-design", "pm.failure-taxonomy", "app.eval-observability"] },
  { pattern: /agent|智能体|工具调用|自治/, nodes: ["app.tools", "app.agents", "pm.interaction-fallback"] },
  { pattern: /rag|检索|知识库/, nodes: ["app.rag", "app.eval-observability"] },
  { pattern: /开发|编程|代码|build|工程|应用实现|部署/, nodes: ["app.prompting", "app.tools", "app.security", "app.deployment"] },
  { pattern: /基础|入门|通识|理解|认知|使用/, nodes: ["ai.scope", "ai.genai-llm", "ai.capability-boundary", "use.discernment"] },
];

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

function suppliedCourseIds(intake: LearningIntake, courses: PublishedCourse[]): Set<string> {
  const supplied = new Set<string>();
  for (const material of intake.materials) {
    const materialUrl = normalizeUrl(material.url);
    const materialTitle = material.title.trim().toLowerCase();
    const match = courses.find((course) =>
      (materialUrl && normalizeUrl(course.genome.url) === materialUrl)
      || (materialTitle.length >= 5 && course.genome.title.toLowerCase().includes(materialTitle))
      || (materialTitle.length >= 5 && materialTitle.includes(course.genome.title.toLowerCase())),
    );
    if (match) supplied.add(match.genome.id);
    if (!match && material.url) {
      try {
        const materialUrl = new URL(material.url);
        const isCatalog = /\/(courses|training|learn|academy)\/?$/i.test(materialUrl.pathname);
        if (isCatalog) {
          courses.filter((course) => new URL(course.genome.url).hostname === materialUrl.hostname)
            .forEach((course) => supplied.add(course.genome.id));
        }
      } catch {
        // URL validation occurs at the intake boundary; malformed optional values simply do not scope a catalog.
      }
    }
  }
  return supplied;
}

function catalogScopeCourseIds(intake: LearningIntake, courses: PublishedCourse[]): Set<string> {
  const scoped = new Set<string>();
  if (/(?:仅|只)(?:采用|使用|选择|用|学)?\s*DeepLearning\.?AI/i.test(intake.goal)) {
    courses.filter(course => /DeepLearning\.?AI/i.test(course.genome.provider)).forEach(course => scoped.add(course.genome.id));
    return scoped;
  }
  for (const material of intake.materials) {
    try {
      const url = new URL(material.url);
      if (!/\/(courses|training|learn|academy)\/?$/i.test(url.pathname)) continue;
      courses.filter((course) => new URL(course.genome.url).hostname === url.hostname)
        .forEach((course) => scoped.add(course.genome.id));
    } catch {
      // Non-URL materials do not constrain the catalog.
    }
  }
  return scoped;
}

export function deriveTargetNodeIds(goal: string, graph: DomainGraph, proposed: string[] = []): string[] {
  const valid = new Set(graph.nodes.map((node) => node.id));
  const selected = new Set(proposed.filter((id) => valid.has(id)));
  const positiveGoal = goal.toLowerCase().replace(/(?:没有|无|不具备)\s*(?:编程|python|代码)\s*基础/g, "零基础");
  for (const alias of goalAliases) {
    if (alias.pattern.test(positiveGoal)) alias.nodes.filter((id) => valid.has(id)).forEach((id) => selected.add(id));
  }
  if (selected.size === 0) {
    const foundationCategory = graph.categories.find((category) => /基础|foundation/i.test(`${category.id} ${category.title}`))?.id
      ?? graph.categories[0]?.id;
    graph.nodes.filter((node) => node.categoryId === foundationCategory).slice(0, 4).forEach((node) => selected.add(node.id));
  }
  return Array.from(selected).slice(0, 14);
}

export function prerequisiteClosure(targetNodeIds: string[], graph: DomainGraph): string[] {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const result = new Set<string>();
  const visit = (id: string) => {
    if (result.has(id)) return;
    const node = byId.get(id);
    if (!node) return;
    node.prerequisiteNodeIds.forEach(visit);
    result.add(id);
  };
  targetNodeIds.forEach(visit);
  return Array.from(result);
}

function courseScore(input: {
  course: PublishedCourse;
  mapping: UnitNodeMapping;
  supplied: Set<string>;
  usedUnits: Set<string>;
  selectedCourses: Set<string>;
  pinned: Set<string>;
  productGoal: boolean;
}): number {
  const { course, mapping, supplied, usedUnits, selectedCourses, pinned, productGoal } = input;
  const levelScore = course.genome.level === "introductory" ? 3 : course.genome.level === "beginner" ? 2 : course.genome.level === "intermediate" ? 0 : -2;
  const relationScore = mapping.relation === "core" ? 4 : mapping.relation === "supporting" ? 2 : 0;
  const sourceScore = course.genome.sourceCitations.some((citation) =>
    ["academic_standard", "academic_course", "official_curriculum", "official_documentation"].includes(citation.sourceClass)) ? 2 : 0;
  return relationScore + levelScore + sourceScore + mapping.confidence * 4
    + (supplied.has(course.genome.id) ? 6 : 0)
    + (selectedCourses.has(course.genome.id) ? 5 : 0)
    + (pinned.has(course.genome.id) ? 20 : 0)
    + (usedUnits.has(`${course.genome.id}/${mapping.unitId}`) ? 3 : 0)
    - Math.max(0, course.genome.prerequisites.length - 1) * 2
    - (productGoal && course.genome.prerequisites.some((item) => /python|pytorch|代码|编程/i.test(item)) ? 8 : 0)
    - (productGoal && (course.tags.includes("ai-builder") || course.genome.audiences.some((item) => /python|开发者|工程师/i.test(item))) ? 8 : 0);
}

export function solveCurriculum(input: {
  intake: LearningIntake;
  courses: PublishedCourse[];
  graph: DomainGraph;
  interpretedGoal: string;
  targetNodeIds: string[];
  now?: string;
  id?: string;
  constraints?: CurriculumConstraint[];
}): CurriculumAssembly {
  const constraints = input.constraints ?? [];
  const knownCourseIds = new Set(input.courses.map((course) => course.genome.id));
  const knownNodeIds = new Set(input.graph.nodes.map((node) => node.id));
  for (const constraint of constraints) {
    if ("courseId" in constraint && !knownCourseIds.has(constraint.courseId)) throw new Error(`约束引用未知课程：${constraint.courseId}`);
    if ("nodeId" in constraint && !knownNodeIds.has(constraint.nodeId)) throw new Error(`约束引用未知节点：${constraint.nodeId}`);
    if (constraint.type === "select_units") {
      const course = input.courses.find((item) => item.genome.id === constraint.courseId)!;
      const unitIds = new Set(course.genome.units.map((unit) => unit.id));
      const unknown = constraint.unitIds.find((id) => !unitIds.has(id));
      if (unknown) throw new Error(`约束引用未知章节：${constraint.courseId}/${unknown}`);
    }
  }
  const includedNodes = constraints.filter((item) => item.type === "include_node").map((item) => item.nodeId);
  const excludedNodes = new Set(constraints.filter((item) => item.type === "exclude_node").map((item) => item.nodeId));
  const targetNodeIds = prerequisiteClosure([...input.targetNodeIds, ...includedNodes], input.graph)
    .filter((id) => !excludedNodes.has(id));
  if (targetNodeIds.length === 0) throw new Error("目标约束移除了全部学习节点");
  const pinned = new Set(constraints.filter((item) => item.type === "pin_course").map((item) => item.courseId));
  const excludedCourses = new Set(constraints.filter((item) => item.type === "exclude_course").map((item) => item.courseId));
  const deferredCourses = new Set(constraints.filter((item) => item.type === "defer_course").map((item) => item.courseId));
  const selectedUnits = new Map(constraints.filter((item) => item.type === "select_units")
    .map((item) => [item.courseId, new Set(item.unitIds)]));
  const productGoal = /产品|product|pm|prd|用户价值|业务|场景|决策/.test(input.intake.goal.toLowerCase());
  const lacksProgramming = /(?:没有|无|不具备)\s*(?:编程|python|代码)\s*基础/i.test(input.intake.goal);
  const maxCurrentCourses = Math.max(3, pinned.size);
  const supplied = suppliedCourseIds(input.intake, input.courses);
  const catalogScope = catalogScopeCourseIds(input.intake, input.courses);
  const usedUnits = new Set<string>();
  const selectedByCourse = new Map<string, Set<string>>();
  const mappings: UnitNodeMapping[] = [];
  const uncovered: string[] = [];
  const stages: CurriculumAssembly["stages"] = [];
  const courseById = new Map(input.courses.map((course) => [course.genome.id, course]));

  for (const nodeId of targetNodeIds) {
    let candidates = input.courses
      .filter((course) => !excludedCourses.has(course.genome.id) && !deferredCourses.has(course.genome.id))
      .filter(course => !lacksProgramming || pinned.has(course.genome.id) || !course.genome.prerequisites.some(item => /python|pytorch|代码|编程/i.test(item)))
      .filter((course) => !productGoal || pinned.has(course.genome.id)
        || !course.tags.includes("ai-builder") || course.tags.includes("ai-product"))
      .filter((course) => catalogScope.size === 0 || catalogScope.has(course.genome.id))
      .flatMap((course) => course.mappings
      .filter((mapping) => mapping.nodeId === nodeId && mapping.confidence >= 0.8
        && (!selectedUnits.has(course.genome.id) || selectedUnits.get(course.genome.id)!.has(mapping.unitId)))
      .map((mapping) => ({
        course, mapping,
        score: courseScore({ course, mapping, supplied, usedUnits, selectedCourses: new Set(selectedByCourse.keys()), pinned, productGoal }),
      })))
      .sort((a, b) => b.score - a.score || a.course.genome.id.localeCompare(b.course.genome.id));
    if (selectedByCourse.size >= maxCurrentCourses) {
      candidates = candidates.filter((candidate) => selectedByCourse.has(candidate.course.genome.id) || pinned.has(candidate.course.genome.id));
    }
    const selected = candidates[0];
    if (!selected) {
      uncovered.push(nodeId);
      continue;
    }
    const key = `${selected.course.genome.id}/${selected.mapping.unitId}`;
    usedUnits.add(key);
    const units = selectedByCourse.get(selected.course.genome.id) ?? new Set<string>();
    units.add(selected.mapping.unitId);
    selectedByCourse.set(selected.course.genome.id, units);
    if (!mappings.some((mapping) => mapping.courseId === selected.mapping.courseId
      && mapping.unitId === selected.mapping.unitId && mapping.nodeId === selected.mapping.nodeId)) {
      mappings.push(selected.mapping);
    }
  }

  const selectedCourseIds = Array.from(selectedByCourse.keys());
  const decisions: CurriculumAssembly["decisions"] = input.courses.map((course, index) => {
    const unitIds = Array.from(selectedByCourse.get(course.genome.id) ?? []);
    const activeIndex = selectedCourseIds.indexOf(course.genome.id);
    if (unitIds.length === 0) {
      const forcedRole = excludedCourses.has(course.genome.id) ? "exclude" as const
        : deferredCourses.has(course.genome.id) ? "defer" as const : null;
      return {
        courseId: course.genome.id,
        role: forcedRole ?? (supplied.has(course.genome.id) ? "defer" as const : "exclude" as const),
        selectedUnitIds: [],
        rationale: supplied.has(course.genome.id) ? "这是用户已有课程，但当前阶段没有必要覆盖的目标节点，先保留。" : "当前目标已有更直接或更低前置成本的课程覆盖。",
        confidence: 0.78,
        exitCriteria: [],
        sourceCitations: course.genome.sourceCitations,
      };
    }
    return {
      courseId: course.genome.id,
      role: activeIndex === 0 ? "anchor" as const : "selected_units" as const,
      selectedUnitIds: unitIds,
      rationale: supplied.has(course.genome.id)
        ? "优先复用用户已有课程，并只采用与目标节点直接相关的章节。"
        : "在发布课程中，该课程以较低前置成本覆盖当前目标节点。",
      confidence: Math.max(0.8, 0.94 - activeIndex * 0.02 - index * 0.0001),
      exitCriteria: ["能够说明本阶段关键概念的适用边界", "完成课程原有测试或留下一个具体判断信号"],
      sourceCitations: course.genome.sourceCitations,
    };
  });

  for (let index = 0; index < selectedCourseIds.length; index += 1) {
    const courseId = selectedCourseIds[index]!;
    const course = courseById.get(courseId)!;
    const unitIds = Array.from(selectedByCourse.get(courseId) ?? []).sort((a, b) => {
      const aUnit = course.genome.units.find((unit) => unit.id === a);
      const bUnit = course.genome.units.find((unit) => unit.id === b);
      return (aUnit?.order ?? 0) - (bUnit?.order ?? 0);
    });
    stages.push({
      id: `stage.${index + 1}`,
      title: index === 0 ? "共同基础与判断" : `目标分支 ${index + 1}`,
      objective: `使用 ${course.genome.title} 建立当前阶段所需能力，不扩展到未采用章节。`,
      unitRefs: unitIds.map((unitId) => ({ courseId, unitId })),
      exitCriteria: ["完成采用章节并达到课程原有测试要求", "能在一个具体情景中说明适用边界"],
      anchorCourseId: courseId,
      supplementCourseIds: [],
      stopAfterUnitId: unitIds.at(-1),
    });
  }

  if (stages.length === 0) throw new Error("当前发布课程无法形成可执行路线");
  const coveredByEarlier = new Set<string>();
  const comparisons: CurriculumAssembly["comparisons"] = input.courses.map((course) => {
    const decision = decisions.find((item) => item.courseId === course.genome.id)!;
    const selected = new Set(decision.selectedUnitIds);
    const coveredNodeIds = Array.from(new Set(course.mappings
      .filter((mapping) => targetNodeIds.includes(mapping.nodeId))
      .map((mapping) => mapping.nodeId)));
    const overlapUnitIds = course.mappings
      .filter((mapping) => selected.has(mapping.unitId) && coveredByEarlier.has(mapping.nodeId))
      .map((mapping) => mapping.unitId);
    if (["anchor", "selected_units", "supplement"].includes(decision.role)) coveredNodeIds.forEach((id) => coveredByEarlier.add(id));
    const sourceClass = course.genome.sourceCitations[0]?.sourceClass;
    const sourceFit = sourceClass === "academic_standard" ? "defining" as const
      : ["academic_course", "official_curriculum"].includes(sourceClass ?? "") ? "systematic" as const
        : sourceClass === "official_documentation" ? "reference" as const : "practice" as const;
    const estimatedMinutes = course.genome.units.filter((unit) => selected.has(unit.id))
      .reduce((total, unit) => total + (unit.estimatedMinutes ?? 45), 0);
    return {
      courseId: course.genome.id,
      coveredNodeIds,
      overlapUnitIds: Array.from(new Set(overlapUnitIds)),
      prerequisiteBurden: course.genome.prerequisites.length,
      estimatedMinutes,
      sourceFit,
      recommendation: decision.role === "anchor" ? "adopt" as const
        : decision.role === "selected_units" ? "partial" as const
          : decision.role === "supplement" ? "supplement" as const
            : decision.role,
      rationale: decision.rationale,
    };
  });
  let segmentSequence = 1;
  const segments: CurriculumAssembly["segments"] = stages.flatMap((stage) => stage.unitRefs.map((ref) => {
    const course = courseById.get(ref.courseId)!;
    const unit = course.genome.units.find((item) => item.id === ref.unitId)!;
    const nodeIds = Array.from(new Set(course.mappings.filter((mapping) => mapping.unitId === unit.id
      && targetNodeIds.includes(mapping.nodeId)).map((mapping) => mapping.nodeId)));
    const estimatedMinutes = Math.min(90, Math.max(30, Math.round((unit.estimatedMinutes ?? 45) / 15) * 15));
    const locator = unit.sourceLocator;
    return {
      id: `segment.${course.genome.id}.${unit.id}.${segmentSequence}`,
      courseId: course.genome.id,
      courseVersionId: `${course.genome.id}@${course.genome.version}`,
      unitId: unit.id,
      nodeIds: nodeIds.length ? nodeIds : [targetNodeIds[0]!],
      title: `${course.genome.title} · ${unit.title}`,
      sourceUrl: locator?.url ?? course.genome.url,
      locatorLabel: locator?.label || [locator?.startAt, locator?.endAt].filter(Boolean).join(" – ") || unit.title,
      locatorMissing: !locator || Boolean(locator.missingReason),
      estimatedMinutes,
      stopCondition: `完成“${unit.title}”中与本阶段目标直接相关的部分；达到“${stage.exitCriteria[0]}”即可停止。`,
      completionSignal: "课程随堂测试结果、理解状态或一句具体判断，任选其一。",
      sequence: segmentSequence++,
    };
  }));
  const now = input.now ?? new Date().toISOString();
  return {
    schemaVersion: 3,
    id: input.id ?? `curriculum.${crypto.randomUUID()}`,
    learnerIntent: input.interpretedGoal,
    targetNodeIds,
    decisions,
    mappings,
    stages,
    constraints,
    comparisons,
    segments,
    unresolvedGaps: uncovered.map((id) => `发布课程尚未覆盖目标节点：${id}`),
    rationale: catalogScope.size > 0
      ? `路线限定在 ${Array.from(catalogScope).map((id) => courseById.get(id)?.genome.provider).filter(Boolean)[0] ?? "用户指定"} 课程目录内，由已发布节点映射和前置关系压缩；模型不直接决定正式取舍。`
      : "路线由已发布领域图、前置关系、课程章节映射、用户已有材料和时间成本共同求解；模型不直接决定正式取舍。",
    generatedAt: now,
  };
}
