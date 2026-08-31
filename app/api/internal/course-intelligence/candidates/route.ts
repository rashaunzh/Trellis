import { z } from "zod";

import {
  getCourseIntelligenceService,
  jsonError,
  requireCourseIntelligenceAdmin,
} from "../../../learning/_shared.ts";

const statusSchema = z.enum(["candidate", "validated", "rejected", "published"]);

export async function GET(request: Request) {
  try {
    const ownerId = await requireCourseIntelligenceAdmin(request);
    const statusValue = new URL(request.url).searchParams.get("status");
    const status = statusValue ? statusSchema.parse(statusValue) : undefined;
    const service = await getCourseIntelligenceService();
    const [candidates, state] = await Promise.all([service.listCourseCandidates(status), service.getState(ownerId)]);
    return Response.json({ candidates, graph: state.graph });
  } catch (error) {
    return jsonError(error);
  }
}
