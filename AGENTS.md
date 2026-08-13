# Trellis repository instructions

## Product identity

- The product name is Trellis. Do not introduce the legacy names AI Learning OS, LOS, ALS, PACE, PAI, or PAA as current names.
- Trellis is a personal growth and action system. It connects four long-running lines: Learning & Growth (G), Career (J), Business Exploration (B), and Ideas & Innovation (I).
- Learning and Career have maintained route maps. Business and Ideas remain flexible.
- A project is a deliverable container that may support more than one line. A stage is a route marker. A task is the smallest actionable unit. Do not treat stages and projects as synonyms.
- A work artifact is evidence. It is not automatically a separate main line.

## Start and close every agent session

Before changing product state:

1. Read memory/handoff/current.md.
2. Read memory/profile/preferences.yaml.
3. Read memory/decisions/README.md and the decisions relevant to the task.
4. Read the relevant route file under memory/routes/.
5. Read docs/TRELLIS_PRD.md and docs/MEMORY_ARCHITECTURE.md for product or data-model work.

Before ending a material session:

1. Create a dated note under memory/sessions/ when a durable result was produced.
2. Update memory/handoff/current.md with the current focus, confirmed decisions, open questions, and exact next step.
3. Propose, rather than silently apply, changes to long-term routes or user preferences.
4. Link evidence and sources. Do not turn a conversational guess into a user fact.

## Planning rules

- Default time unit: 0.5 star = 15 minutes; 1 star = 30 minutes. Estimates may increase in 0.5-star steps.
- Do not add a live timer in V0.1. Record actual time after work.
- Weekly planning is an interval commitment, not a fixed calendar schedule. A recurring target such as four workouts may be completed on any days inside the week.
- User-facing horizons are: 进行中, 短期启动, 长期规划, 暂停, 完成. Proposed AI changes remain in 待确认 until accepted.
- Every important task should explain why it exists, its prerequisite or sequence when relevant, the next physical action, the expected evidence, and its primary source link.
- A task may be immediately actionable without introducing a separate micro-habit feature.
- Keep enough downstream tasks visible to preserve a sense of the long route, while limiting the weekly commitment.

## AI rules

- Trellis is model-neutral and V0.1 must not require paid model APIs.
- AI discussion is contextual behavior on routes, stages, tasks, concepts, resources, projects, evidence, and JDs; do not make it a standalone destination.
- AI may explain, compare, split, recommend, draft, and evaluate. It may not silently rewrite confirmed plans or memories.
- All AI writes use proposal -> review -> confirmation.
- Fine-tuning is not a memory strategy. Durable memory belongs to Trellis.
- NotebookLM and Gemini may be learning workbenches; Codex may be an execution workbench; Obsidian/Hermes may manage external information. Trellis stores state, decisions, relationships, and links rather than duplicating those tools.

## User collaboration style

- The current priority is to deliver a usable MVP, not to teach every line of code.
- Codex may implement complete, testable feature slices across multiple files.
- Before implementation, explain the goal, scope, and acceptance criteria in simple Chinese.
- After implementation, summarize the important files, architecture decisions, and verification results.
- Explain concepts that affect product decisions, debugging, security, or future maintenance.
- Do not interrupt implementation to explain routine syntax line by line.
- Keep changes reviewable and avoid unrelated refactors.
- For risky or irreversible decisions, stop and ask for confirmation.

## Repository and privacy

- V0.1 keeps code and personal memory in this private repository to support two-computer continuity.
- Never commit API keys, cookies, access tokens, passwords, employer-confidential material, government identifiers, or unredacted sensitive resume data.
- Git history is persistent. If a datum may need true deletion, store only a pointer to an approved external location.
- Prefer one file per session or durable decision to reduce cross-device merge conflicts.
- Pull before writing and push after closing a session. Stop on conflicts; do not overwrite another device's work.
