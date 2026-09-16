import { D1LearningStore } from "../persistence/d1.ts";
import { CourseIntelligenceModelGateway, builtInModelConfig } from "./model-gateway.ts";
import { D1CourseIntelligenceRepository } from "./repository.ts";
import { CourseIntelligenceService } from "./service.ts";

export async function createCourseIntelligenceContext(
  // D1's runtime type is supplied by Cloudflare and deliberately kept at the boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  env: Record<string, unknown>,
) {
  const repository = new D1CourseIntelligenceRepository(db);
  const learningStore = new D1LearningStore(db);
  await learningStore.seedContent();
  const gateway = new CourseIntelligenceModelGateway(repository, builtInModelConfig(env));
  const service = new CourseIntelligenceService(repository, gateway, learningStore);
  await service.initialize();
  return { service, repository, db };
}
