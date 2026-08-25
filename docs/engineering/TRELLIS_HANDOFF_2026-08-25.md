# Trellis Handoff — 2026-08-25

## Current Position

Trellis is a learning workflow engine evolving toward a dynamic learning companion.

The current stable engineering baseline has two parts:

- Formal state-changing loop: activity -> evidence -> review -> scoring -> adjustment -> state change.
- Front-half analysis pipeline: goal analysis -> course/material analysis -> capability mapping -> adaptive plan preview / controlled activation.

The product direction has been corrected: Trellis is not an AIPM-only app. AIPM learning is the first demo topic/content pack. The broader user is a motivated learner with a rough goal, incomplete or unreliable materials, and a need for ongoing guidance, understanding, completion, feedback, and adjustment.

## Completed Engineering Work

### Phase 1: Type Unification And Agent Ports

Completed:

- Unified duplicated `GoalAnalysis`, `CourseMaterialAnalysis`, and `CapabilityMap` contracts in `lib/learning/agents/types.ts`.
- Changed `lib/learning/agents/adaptive-types.ts` to reuse the unified contracts.
- Added rule implementations:
  - `RuleGoalAnalyzer`
  - `RuleCourseMaterialAnalyzer`
- Registered eight agent-like ports in `createRuleAgents()`:
  - `goalAnalyzer`
  - `courseAnalyzer`
  - `capabilityMapper`
  - `adaptiveRoutePlanner`
  - `planner`
  - `activityComposer`
  - `evidenceEvaluator`
  - `adjustmentAdvisor`

### Phase 2: Service Pipeline Wiring

Completed:

```text
runDiagnostic
-> goalAnalyzer
-> courseAnalyzer
-> capabilityMapper
-> adaptiveRoutePlanner
-> workspace.analysis
```

Important boundary:

- `workspace.analysis` is transient.
- Default learner flow still uses the legacy planner.
- No schema or UI changes were required.

### Phase 3: Controlled Adaptive Planner Activation

Completed:

- Added `plannerMode`:
  - `legacy`
  - `adaptive_preview`
  - `adaptive_existing_content`
- Default mode remains `legacy`.
- `adaptive_existing_content` can drive `confirmProposal` only when capability mapping hits existing content pack nodes.
- Generic fallback capability ids never enter official learning activities, node progress, or evidence review.
- Diagnosis inputs are persisted via the existing `learning_diagnostics` table, avoiding schema changes.
- Added `adaptiveDraftToActivity` adapter so adaptive plans can become normal `LearningActivity` records.

Key safety rule:

```text
generic fallback = analysis preview only
existing_content = eligible for controlled adaptive execution
```

## Current Verified Behavior

- Existing legacy route and weekly plan behavior remains default.
- Evidence Review and Adjustment algorithms were not changed.
- Controlled adaptive planning is opt-in through `plannerMode`.
- Existing content pack node ids remain the only ids allowed into the official evidence review loop.

Latest reported validation:

```text
tsc --noEmit --incremental false -> 0 errors
node --test --test-isolation=none "tests/learning-domain/*.test.ts" -> 159/159
npx eslint . --ignore-pattern dist --ignore-pattern .next -> 0 problems
```

If `npm run test:domain` fails on Windows because child process spawn is blocked, use the `node --test --test-isolation=none` command above.

## Files Changed In Current Worktree

Core:

- `lib/learning/agents/types.ts`
- `lib/learning/agents/index.ts`
- `lib/learning/agents/adaptive-types.ts`
- `lib/learning/agents/adaptive-planner.ts`
- `lib/learning/agents/adapters.ts`
- `lib/learning/agents/capability-mapper.ts`
- `lib/learning/agents/course-analyzer.ts`
- `lib/learning/agents/goal-analyzer.ts`
- `lib/learning/application/learning-service.ts`
- `lib/learning/frontend.ts`
- `lib/learning/persistence/store.ts`
- `lib/learning/persistence/in-memory.ts`
- `lib/learning/persistence/d1.ts`

Tests:

- `tests/learning-domain/agents.test.ts`
- `tests/learning-domain/adaptive-planner.test.ts`
- `tests/learning-domain/capability-mapper.test.ts`
- `tests/learning-domain/course-analyzer.test.ts`
- `tests/learning-domain/full-chain-integration.test.ts`
- `tests/learning-domain/goal-analyzer.test.ts`

Memory / engineering notes:

- `memory/handoff/current.md`
- `memory/sessions/2026-08-24-full-chain-phase1-type-unification.md`
- `memory/sessions/2026-08-24-full-chain-phase2-service-pipeline-wiring.md`
- `memory/sessions/2026-08-24-full-chain-phase3-adaptive-controlled-activation.md`
- `memory/sessions/2026-08-24-v0.2-adaptive-route-planner-design.md`
- `memory/sessions/2026-08-24-ponytail-dsh-integration.md`
- `docs/engineering/TRELLIS_V0.2_ADAPTIVE_ROUTE_PLANNER.md`
- `docs/engineering/TRELLIS_HANDOFF_2026-08-25.md`

Small UI wording correction:

- `app/learn/page.tsx` now frames the entry as a learning topic/goal instead of implying AIPM is the whole product.

Do not include the following local artifacts unless explicitly needed:

- `AGENTS.local.md`
- `docs/learn-drawer-assessment.png`
- `docs/learn-drawer-assessment-bottom.png`
- `scripts/trellis-shot.mjs`
- `wrangler.migrate.json`

## Product Direction Correction

The next product frame should not be "task card -> evidence review" only.

Updated product thesis:

```text
Trellis continuously helps a motivated but uncertain learner understand why to learn,
choose how to learn, complete meaningful work, collect soft/hard/behavioral signals,
and adjust the path over time.
```

Important learning signals:

- Hard evidence: projects, reports, tests, code, documents.
- Soft signals: explanation, reflection, questions, confusion notes, dialogue, examples.
- Behavioral signals: completion rate, skipped work, repeated gaps, time spent, review intervals.

The next major design layer should be:

```text
Learning Situation Model + Agent Decision Layer
```

This layer should decide:

- current learning stage
- current learning need
- recommended learning mode
- whether hard evidence is required
- what can be reordered safely
- what should happen next

## Recommended Next Work

Do not immediately add another broad framework or rewrite the planner.

Recommended next slice:

```text
Learning Situation / Agent Decision Layer
```

Suggested types:

```text
LearningStage:
orientation | foundation | guided_practice | independent_practice |
artifact_building | review_and_repair | consolidation | portfolio_packaging

LearningNeed:
clarify_goal | build_understanding | practice_skill | produce_artifact |
review_evidence | repair_gap | spaced_review | motivation_support | route_correction

LearningSignalType:
hard_evidence | soft_signal | behavior_signal
```

Suggested decision output:

```text
stage
primaryNeed
recommendedMode
reason
expectedOutcome
evidencePolicy
tolerance
toolCalls
```

Test with real scenarios:

- AIPM goal is vague -> orientation + clarify goal.
- User has unreliable course material -> material review / route correction.
- Beginner has weak basics -> foundation + explanation.
- User consumed content but produced nothing -> artifact building + produce.
- Evidence failed -> review and repair.
- Repeated non-completion -> reduce scope / motivation support.
- Validated node is due for review -> spaced review.
- Deadline is near -> portfolio packaging.

## Resume Steps On Another Computer

```bash
git clone <repo-url>
cd "Project - Trellis"
npm install
git status --short --branch
npx tsc --noEmit --incremental false
node --test --test-isolation=none "tests/learning-domain/*.test.ts"
npx eslint . --ignore-pattern dist --ignore-pattern .next
```

If using the Codex desktop setup, confirm Ponytail is installed:

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

## Caution

Current project status is strong enough to push as an engineering checkpoint, but not yet strong enough to claim Trellis is a full autonomous learning agent.

Accurate claim:

```text
Trellis has a structured learning workflow, agent-like replaceable ports, controlled adaptive planning, evidence-based review, adjustment state transitions, and deterministic tests.
```

Do not claim yet:

```text
Trellis has a full agent runtime, general MCP tool ecosystem, long-term memory layer, or fully autonomous teacher agent.
```
