import { z } from "zod";

import {
  getCourseIntelligenceService,
  jsonError,
  requireCourseIntelligenceAdmin,
} from "../../../../../learning/_shared.ts";

const reviewSchema = z.object({
  decision: z.enum(["validated", "rejected"]),
  reason: z.string().trim().min(3).max(1200),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const reviewerOwnerId = await requireCourseIntelligenceAdmin(request);
    const { id } = await context.params;
    const body = reviewSchema.parse(await request.json());
    const candidate = await (await getCourseIntelligenceService()).reviewCourseCandidate({
      candidateId: id,
      reviewerOwnerId,
      ...body,
    });
    return Response.json({ candidate });
  } catch (error) {
    return jsonError(error);
  }
}
