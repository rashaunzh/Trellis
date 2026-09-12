import { z } from "zod";
import { jsonError, requireCourseIntelligenceAdmin } from "../../../learning/_shared.ts";
import { assessProgramCheck, planLearningProgram, programUnits, publicProgramUnit } from "../../../../../lib/learning/intelligence/learning-program.ts";

const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("plan"), request: z.unknown() }),
  z.object({ action: z.literal("check"), unitId: z.string(), phase: z.enum(["diagnostic", "review"]), answers: z.record(z.string(), z.string()), usedHelp: z.boolean() }),
]);
/** 内容审阅原型，不激活用户路线。后续接入正式服务前不得作为生产学习入口。 */
export async function POST(request: Request) {
  try {
    await requireCourseIntelligenceAdmin(request);
    const body = input.parse(await request.json());
    if (body.action === "plan") return Response.json({ plan: planLearningProgram(body.request), units: programUnits.map(unit => publicProgramUnit(unit.id)) });
    return Response.json({ result: assessProgramCheck(body.unitId, body.phase, body.answers, body.usedHelp) });
  } catch (error) { return jsonError(error); }
}
