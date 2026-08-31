import { runTrellisMastraWorkflowDemo } from "../lib/learning/agents/mastra-workflow.ts";

const demo = await runTrellisMastraWorkflowDemo();

console.log(JSON.stringify(demo, null, 2));
