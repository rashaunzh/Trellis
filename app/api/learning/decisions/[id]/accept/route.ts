import { getCourseIntelligenceContext, jsonError, ownerOf } from "../../../_shared.ts";
import { resumeCourseIntelligenceWorkflow, resumeSourceEvolutionWorkflow, startCourseIntelligenceWorkflow } from "../../../../../../lib/learning/intelligence/workflow-runtime.ts";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await ownerOf(request);
    const { id } = await context.params;
    const { service, repository, db } = await getCourseIntelligenceContext();
    const decision = await service.getDecision(ownerId, id);
    if (!decision) return Response.json({ error: "决策不存在" }, { status: 404 });
    if (decision.decisionType === "curriculum_synthesis") {
      const result = await resumeCourseIntelligenceWorkflow({
        ownerId, curriculumId: decision.aggregateId, approved: true, service, repository, db,
      });
      return Response.json(result);
    }
    if (decision.decisionType === "source_evolution") {
      const updated = await resumeSourceEvolutionWorkflow({
        decision, approved: true, actorOwnerId: ownerId, service, repository, db,
      });
      return Response.json({ decision: updated });
    }
    const accepted = await service.acceptDecision(ownerId, id);
    if (accepted.decisionType === "learning_adaptation" && accepted.proposal.outcome === "replan") {
      const current = await service.getCurrentLearning(ownerId);
      if (!current.curriculum) throw Object.assign(new Error("当前没有可重算的课程方案"), { status: 409 });
      const workflow = await startCourseIntelligenceWorkflow({
        ownerId, rawIntake: current.curriculum.intake, service, repository, db,
      });
      const applied = await service.applyDecision(ownerId, id, { generatedCurriculumId: workflow.curriculum.id });
      return Response.json({ decision: applied, workflow });
    }
    return Response.json({ decision: await service.applyDecision(ownerId, id) });
  } catch (error) {
    return jsonError(error);
  }
}
