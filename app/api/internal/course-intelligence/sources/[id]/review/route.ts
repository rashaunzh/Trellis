import { z } from "zod";

import { getCourseIntelligenceContext, jsonError, requireCourseIntelligenceAdmin } from "../../../../../learning/_shared.ts";
import { resumeSourceEvolutionWorkflow } from "../../../../../../../lib/learning/intelligence/workflow-runtime.ts";

const inputSchema = z.object({ decisionId: z.string().min(1), approved: z.boolean() });

export async function POST(request: Request) {
  try {
    const actorOwnerId = await requireCourseIntelligenceAdmin(request);
    const input = inputSchema.parse(await request.json());
    const { service, repository, db } = await getCourseIntelligenceContext();
    const decision = await repository.getDecision(input.decisionId, "system");
    if (!decision || decision.decisionType !== "source_evolution") {
      return Response.json({ error: "来源演进决策不存在" }, { status: 404 });
    }
    const updated = await resumeSourceEvolutionWorkflow({
      decision, approved: input.approved, actorOwnerId, service, repository, db,
    });
    return Response.json({ decision: updated });
  } catch (error) {
    return jsonError(error);
  }
}
