import { z } from "zod";

import {
  getCourseIntelligenceService,
  jsonError,
  requireCourseIntelligenceAdmin,
} from "../../../learning/_shared.ts";

const statusSchema = z.enum(["candidate", "validated", "rejected", "published"]);

export async function GET(request: Request) {
  try {
    await requireCourseIntelligenceAdmin(request);
    const statusValue = new URL(request.url).searchParams.get("status");
    const status = statusValue ? statusSchema.parse(statusValue) : undefined;
    const candidates = await (await getCourseIntelligenceService()).listCourseCandidates(status);
    return Response.json({ candidates });
  } catch (error) {
    return jsonError(error);
  }
}
