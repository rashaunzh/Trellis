import { z } from "zod";
import type { DomainGraph } from "./course-intelligence.ts";
import type { GroundingReport } from "./model-gateway.ts";

export const modelTaskKinds = ["learning_intent.v1", "course_outline.v1", "unit_node_mapping.v1"] as const;
export type ModelTaskKind = typeof modelTaskKinds[number];

export const learningIntentResultSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  targetNodeIds: z.array(z.string()).min(1).max(14),
  outOfScope: z.array(z.string()).max(8).default([]),
});

export const courseOutlineResultSchema = z.object({
  title: z.string().trim().min(1).max(200),
  level: z.enum(["introductory", "beginner", "intermediate", "advanced"]),
  audiences: z.array(z.string().trim().min(1)).min(1).max(8),
  prerequisites: z.array(z.string().trim().min(1)).max(12),
  units: z.array(z.object({ title: z.string().trim().min(1).max(200) })).min(1).max(80),
});

export const unitNodeMappingResultSchema = z.object({
  mappings: z.array(z.object({
    unitTitle: z.string().trim().min(1).max(200),
    nodeId: z.string().trim().min(1),
    depth: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    relation: z.enum(["core", "supporting", "context"]),
    confidence: z.number().min(0).max(1),
    rationale: z.string().trim().min(1).max(400),
  })).min(1).max(80),
});

export type LearningIntentResult = z.infer<typeof learningIntentResultSchema>;
export type CourseOutlineResult = z.infer<typeof courseOutlineResultSchema>;
export type UnitNodeMappingResult = z.infer<typeof unitNodeMappingResultSchema>;

export const modelTaskContracts = {
  learningIntent: {
    kind: "learning_intent.v1" as const,
    contractVersion: "learning_intent.v1",
    system: "解释学习目标并提出有限目标节点。只能使用给定节点 ID，不得选择与目标无关的工程前置。",
    schema: learningIntentResultSchema,
  },
  courseOutline: {
    kind: "course_outline.v1" as const,
    contractVersion: "course_outline.v1",
    system: "从课程目录中识别课程标题、难度、受众、前置和真实章节。不得补写目录中没有的章节。",
    schema: courseOutlineResultSchema,
  },
  unitNodeMapping: {
    kind: "unit_node_mapping.v1" as const,
    contractVersion: "unit_node_mapping.v1",
    system: "把每个真实课程章节映射到最相关的知识节点。只能使用给定章节标题和节点 ID，并说明依据与置信度。",
    schema: unitNodeMappingResultSchema,
  },
};

export function groundLearningIntent(value: LearningIntentResult, graph: DomainGraph): GroundingReport {
  const known = new Set(graph.nodes.map((node) => node.id));
  const issues = value.targetNodeIds.filter((id) => !known.has(id)).map((id) => `unknown_node:${id}`);
  return { passed: issues.length === 0, issues };
}

export function groundCourseOutline(value: CourseOutlineResult, sourceLines: string[]): GroundingReport {
  const normalizedLines = sourceLines.map(normalizeText);
  const issues = value.units
    .filter((unit) => {
      const title = normalizeText(unit.title);
      return looksLikeInstruction(unit.title) || !normalizedLines.some((line) => line.includes(title) || title.includes(line));
    })
    .map((unit) => `invented_unit:${unit.title}`);
  return { passed: issues.length === 0, issues };
}

function looksLikeInstruction(value: string): boolean {
  return /ignore\s+(all\s+)?previous|system\s+prompt|developer\s+message|忽略.{0,8}(指令|要求)|虚构.{0,8}(章节|课程)/i.test(value);
}

export function groundUnitMappings(value: UnitNodeMappingResult, unitTitles: string[], graph: DomainGraph): GroundingReport {
  const expectedUnits = new Set(unitTitles.map(normalizeText));
  const knownNodes = new Set(graph.nodes.map((node) => node.id));
  const seenUnits = new Set<string>();
  const seenPairs = new Set<string>();
  const issues: string[] = [];
  for (const mapping of value.mappings) {
    const title = normalizeText(mapping.unitTitle);
    if (!expectedUnits.has(title)) issues.push(`unknown_unit:${mapping.unitTitle}`);
    if (!knownNodes.has(mapping.nodeId)) issues.push(`unknown_node:${mapping.nodeId}`);
    const pair = `${title}:${mapping.nodeId}`;
    if (seenPairs.has(pair)) issues.push(`duplicate_mapping:${mapping.unitTitle}:${mapping.nodeId}`);
    seenPairs.add(pair);
    seenUnits.add(title);
  }
  for (const title of expectedUnits) if (!seenUnits.has(title)) issues.push(`missing_unit:${title}`);
  return { passed: issues.length === 0, issues };
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}
