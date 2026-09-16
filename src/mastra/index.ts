// Mastra CLI / Studio entrypoint.
// Trellis domain logic stays in lib/learning; this file only registers workflows
// so `mastra dev --dir src/mastra` can expose them to Studio.
export { trellisMastraRuntime as mastra } from "../../lib/learning/agents/mastra-workflow.ts";
