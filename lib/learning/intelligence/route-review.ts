type ReviewAssembly = {
  targetNodeIds: string[];
  segments: Array<{ nodeIds: string[]; title: string; estimatedMinutes: number; locatorLabel: string; locatorMissing: boolean; stopCondition: string }>;
  unresolvedGaps: string[];
  planStatus?: "complete" | "limited";
  limitedPlanNotice?: { missingNodeIds: string[] };
};

/** 界面只描述实际编排覆盖，不把覆盖数量解释为课程质量或学习效果。 */
export function routeReviewSummary(assembly: ReviewAssembly, nodes: Array<{ id: string; title: string }>) {
  const covered = new Set(assembly.segments.flatMap(item => item.nodeIds));
  const missing = [...new Set([...assembly.targetNodeIds.filter(id => !covered.has(id)), ...(assembly.limitedPlanNotice?.missingNodeIds ?? [])])];
  const title = (id: string) => nodes.find(node => node.id === id)?.title ?? "尚未命名的学习目标（需重新核对路线）";
  const limited = assembly.planStatus === "limited" || missing.length > 0 || assembly.unresolvedGaps.length > 0;
  const first = assembly.segments[0];
  return {
    limited, missing: [...new Set(missing.map(title))],
    covered: assembly.targetNodeIds.filter(id => covered.has(id)).map(title),
    coverageLabel: limited ? "当前只能覆盖部分目标" : assembly.planStatus === undefined ? "此版本未记录完整覆盖检查" : "已为当前识别的目标安排材料",
    confirmLabel: limited ? "先开始已覆盖的部分" : "确认并开始",
    firstAction: first ? { title: first.title, minutes: first.estimatedMinutes, stopCondition: first.stopCondition,
      location: first.locatorMissing ? `进入课程后寻找“${first.locatorLabel || first.title}”；目前尚无直达章节位置。` : first.locatorLabel || first.title } : null,
  };
}
