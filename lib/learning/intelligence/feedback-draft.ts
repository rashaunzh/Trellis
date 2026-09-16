import { z } from "zod";
import { scenarioCheckSchema } from "./course-intelligence.ts";

export const feedbackDraftSchema = z.object({
  version: z.literal(1),
  mode: z.enum(["learning", "completion", "time"]),
  feedback: z.enum(["understood", "uncertain", "blocked"]),
  quiz: z.enum(["not_taken", "passed", "failed"]),
  completionIntent: z.enum(["auto", "complete", "keep_open"]),
  actualMinutes: z.number(),
  note: z.string().max(1200),
  scenario: scenarioCheckSchema.omit({ correctOptionId: true, rationale: true }).nullable(),
  scenarioChoice: z.string().max(160),
  expectedSignalId: z.string().nullable(),
});
