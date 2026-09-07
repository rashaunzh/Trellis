import { loadEnvFile } from "node:process";

try { loadEnvFile(".env.local"); } catch (error) {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
}

import { publishedDomainGraph } from "../../lib/learning/intelligence/baseline.ts";
import {
  groundLearningIntent,
  modelTaskContracts,
} from "../../lib/learning/intelligence/model-contracts.ts";
import {
  builtInModelConfig,
  CourseIntelligenceModelGateway,
} from "../../lib/learning/intelligence/model-gateway.ts";
import { InMemoryCourseIntelligenceRepository } from "../../lib/learning/intelligence/repository.ts";

const routes = builtInModelConfig(process.env);
const configured = [routes.primary, routes.fallback].filter(Boolean);

if (configured.length === 0) {
  console.log("SKIP model smoke: no model credentials configured");
  process.exit(0);
}

let failed = false;
for (const configuredSlot of configured) {
  const repository = new InMemoryCourseIntelligenceRepository();
  const gateway = new CourseIntelligenceModelGateway(repository, {
    primary: { ...configuredSlot, slot: "primary" },
    fallback: null,
  });
  const result = await gateway.structuredDetailed({
    ownerId: `model-smoke-${configuredSlot.slot}`,
    kind: modelTaskContracts.learningIntent.kind,
    contractVersion: modelTaskContracts.learningIntent.contractVersion,
    system: modelTaskContracts.learningIntent.system,
    data: {
      goal: "判断 Agent 产品场景，理解能力边界、人工兜底和评测方案",
      availableNodes: publishedDomainGraph.nodes.map(({ id, title }) => ({ id, title })),
    },
    schema: modelTaskContracts.learningIntent.schema,
    grounding: (value) => groundLearningIntent(value, publishedDomainGraph),
    bypassCache: true,
  });
  const relevant = Boolean(result.value?.targetNodeIds.some((id) => id.startsWith("pm.")));
  const passed = result.value !== null && result.eval.passed && relevant;
  failed ||= !passed;
  const latencyMs = result.attempts.reduce((sum, item) => sum + item.latencyMs, 0);
  const tokens = result.attempts.reduce((sum, item) => sum + item.promptTokens + item.completionTokens, 0);
  const failures = result.attempts.filter((item) => item.failureClass).map((item) => item.failureClass);
  console.log(`${passed ? "PASS" : "FAIL"} ${configuredSlot.slot}/${configuredSlot.provider}/${configuredSlot.model} · ${latencyMs}ms · ${tokens} tokens${failures.length ? ` · ${failures.join(",")}` : ""}`);
}

if (failed) process.exit(1);
