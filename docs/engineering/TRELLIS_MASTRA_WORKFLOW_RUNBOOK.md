# Trellis Mastra Workflow Runbook

> 日期：2026-08-27
> 状态：作品级演示入口
> 目标：展示 Trellis 的 agentic learning workflow 如何运行，而不是替换现有领域引擎。

## 当前结论

本仓库当前安装的是 `@mastra/core@1.62.0`。它提供 `createWorkflow` / `createStep` / `createRun().start()` 等 runtime API；Studio/CLI 入口通过 `npx mastra ...` 暴露，换机后可能需要首次下载 CLI 包。

因此当前可交付口径是：

- 已有真实 Mastra workflow 对象：`trellisLearningSituationWorkflow`；
- 已有 Mastra runtime 实例：`trellisMastraRuntime`，通过 `new Mastra({ workflows })` 注册核心 workflow；
- 已有 Mastra CLI / Studio 入口：`src/mastra/index.ts` 导出 `mastra`，供 `mastra dev --dir src/mastra` 识别；
- 已有可运行命令：`npm run demo:mastra`；
- 已有 CLI 脚本：`npm run mastra:dev` 与 `npm run mastra:studio`；
- 已有 API 入口：`GET/POST /api/learning/mastra-runtime`；
- `/learn` 作品级质量面板可运行 Mastra runtime 并展示 10-step trace；
- 已有固定 demo trace，可用于作品集讲解和截图；
- 已有 Studio 截图素材 `docs/mastra-studio-1-studio-home.png` / `-2-workflows-list.png` / `-3-workflow-graph.png` 与截图脚本 `scripts/mastra-studio-shot.mjs`；发布前可复跑更新。
- 已有 server API 运行的 step output 证据 `docs/mastra-studio-run-output.json`（10 步 trace + 5 个 HITL + stagePath/dynamicSimulation/qualitySummary/runtimeReadiness/resumeContract）。

## 运行命令

```bash
npm run demo:mastra
```

## Studio / CLI 入口

```bash
npm run mastra:dev
npm run mastra:studio
```

说明：

- `src/mastra/index.ts` 按 Mastra 官方约定导出 `mastra`；
- `mastra:dev` 使用 `npx mastra@1.27.0 dev --dir src/mastra`，启动 Mastra server 与 Studio；
- `mastra:studio` 使用 `npx mastra@1.27.0 studio --server-port 4111`，运行独立 Studio UI（默认端口 3000）连接已运行的 Mastra server；dev server 本身已自带 Studio，因此该命令可选。

### 已验收事实（2026-08-28）

- CLI 版本：`mastra@1.27.0`（npm latest 即 1.27.0；npm scripts 已 pin 该版本，避免 CLI 漂移破坏与 `@mastra/core@1.62.0` 的兼容性）。
- `npm run mastra:dev` 实测通过：`mastra dev --dir src/mastra` 打包 workflow 成功，server 监听 `http://localhost:4111`，Studio 由 dev server 直接提供（`http://localhost:4111`），Studio 头部显示 runtime 版本 `v1.62.0`，`GET /api/workflows` 列出 `trellisLearningSituationWorkflow` 的 10 个 step。
- Studio workflow graph 页渲染全部 10 个 step 名称，HITL 节点有可辨识标记（如 `waitForMasteryConfirmation` / `Mastery Confirmation`）。
- Mastra server API 全链路可运行：`POST /api/workflows/{key}/create-run?runId=...` → `POST /api/workflows/{key}/start?runId=...`（body 带 `inputData`）→ `GET /api/workflows/{key}/runs/{runId}` 返回 `status: "success"` 与完整 step 输出（注：API 路径中的 `{key}` 是注册键 `trellisLearningSituationWorkflow`，不是 workflow `id` 的 kebab 名）。
- 首次运行 `npx mastra` 需下载 CLI 包（需可达 npm registry；本机经 Clash 代理 `127.0.0.1:7890`）。

### Studio 截图（2026-08-28 已验收）

由 `scripts/mastra-studio-shot.mjs` 对 `mastra dev` 生成，存入 `docs/`：

| 文件 | 内容 |
|---|---|
| `docs/mastra-studio-1-studio-home.png` | Studio 首页（导航：Agents / Workflows / Observability / Evaluation 等） |
| `docs/mastra-studio-2-workflows-list.png` | Workflows 列表页，含 `trellis-learning-situation-workflow` |
| `docs/mastra-studio-3-workflow-graph.png` | workflow graph：10 个 step 节点 + HITL 标记（`Mastery Confirmation` 等） |
| `docs/mastra-studio-run-output.json` | server API run 的 step output 证据（10 步 trace、5 HITL、stagePath、dynamicSimulation、qualitySummary、runtimeReadiness、resumeContract、fallbackMode=rule） |

复跑更新：先 `npm run mastra:dev`，再 `node scripts/mastra-studio-shot.mjs`。

### 边界（Studio 部分）

- Studio 的 runs / traces 页在当前 dev server（内存存储）下未显示已运行的 run：runs 列表需要 Studio 内选中 workflow 的 UI 状态，traces 需要 observability 存储。因此 step output 的证据以 run detail API（`docs/mastra-studio-run-output.json`）、`npm run demo:mastra` 和 `/learn` 的 Mastra runtime trace 为准，不以 Studio runs/traces 页为准。
- Studio 截图是作品集辅助证据；自动验收以 `npm run demo:mastra`、`npm run acceptance:next-stage` 和 `npm run acceptance:portfolio` 为准。
- 受限 shell（如 DSH 沙箱）下，mastra CLI 的 esbuild postinstall 与 headless Chrome（crashpad/mojo）需要完整 OS 访问权限；普通终端无此限制。

## API 入口

```bash
GET /api/learning/mastra-runtime
POST /api/learning/mastra-runtime
```

预期：

- `GET` 返回 runtime 注册状态、workflow id、10 个 steps、5 个 HITL 节点和 Studio 边界；
- `POST` 运行固定作品级 workflow demo，返回 `runId`、`traceId`、`workflowTrace`、`stepOutputs`、`hitlCheckpoints`、`resumeContract`、`runtimeReadiness`、`stagePath`、`dynamicSimulation` 和 `qualitySummary`。

预期输出：

- `status: "success"`；
- `workflowTrace` 含 10 步：
  - `assessSituation`
  - `auditMaterials`
  - `mapCapabilities`
  - `planStagePath`
  - `simulateDynamicAdjustment`
  - `createArtifactTask`
  - `reviewArtifactEvidence`
  - `waitForMasteryConfirmation`
  - `proposeNextStage`
  - `summarizeQuality`
- `stagePath.durationWeeks = 8`；
- `dynamicSimulation.adjustments.length = 4`；
- `nextStageProposal.status = "proposed"`；
- `qualitySummary.toolRegistryReady = true`；
- `runtimeReadiness.executable = true`；
- `resumeContract.canResumeViaApi = true`；
- `fallbackMode = "rule"`。

## Demo Payload

固定输入：

```json
{
  "goal": "我是转 AI PM 的小白，希望 8 周内完成一个 AI Agent 产品 PRD 作品集项目",
  "weeklyMinutes": 240,
  "materialIds": ["res.gml-crash-course"],
  "selfReport": {},
  "preference": "breadth_first"
}
```

这个输入故意触发：

- AI PM 转型目标；
- 资料适配不足；
- 每周时间只有 4 小时；
- 需要完整阶段路径；
- 需要前三周动态调整演示。

## Workflow 边界

Mastra 承载：

- workflow step 边界；
- step 顺序；
- runId / traceId；
- step outputs；
- HITL checkpoint report；
- resume contract report；
- 后续 Studio / observability 接入点。

Trellis 规则引擎承载：

- Learning Situation 判断；
- Material Review；
- Capability Map；
- Stage Path；
- Dynamic Sprint Simulation；
- Evidence / Adjustment 的 fallback 规则。

## HITL 节点

当前 demo trace 中显式标记 HITL：

- `planStagePath`：阶段路径、作品目标、主线变化需要确认；
- `simulateDynamicAdjustment`：资料取舍、作品推进、阶段调整需要确认；
- `createArtifactTask`：正式作品任务进入活动链前需要确认；
- `waitForMasteryConfirmation`：hard evidence accepted 后仍需要用户确认掌握；
- `proposeNextStage`：下一阶段 route_revision 只能 proposed，等待用户采纳。

产品层完整 HITL 边界还包括：

- 资料是否作为主线；
- 作品方向确认；
- 阶段目标变化；
- 掌握确认；
- 重大路径修订。

## 截图点位

1. `/learn` 初始页：Learning Situation-first 入口。
2. `/learn` 诊断提案页：处境判断、8 周 StagePath、前三周动态调整。
3. `npm run demo:mastra` 输出：workflowTrace / HITL / fallbackMode。
4. `/learn` 已确认页：阶段作品闭环、作品级质量面板、eval 与 Mastra runtime trace。
5. 作品任务抽屉：AI Agent 产品 PRD v1 的步骤、证据要求、评审标准和掌握确认说明。
6. 调整记录：作品掌握确认后出现下一阶段 `route_revision proposed` 建议。
7. 采纳下一阶段建议后：`/learn` 显示 `NextStagePlan`，并在本周看板生成作品包装、评测深化和项目讲述三个正式活动。
   - 三个活动会显示/继承作品级 rubric：读者可理解性、eval/fallback/失败样例、10-15 分钟项目讲述。
8. `/api/learning/memory`：Learning Memory Snapshot。
9. `/api/learning/eval`：使用 `POST` 运行作品级 eval，预期 `passRate = 1`。

## 浏览器验收

运行：

```bash
npm run acceptance:next-stage
```

该脚本会：

- 准备固定 demo 状态：AI PM 转型小白、AI Agent 产品 PRD v1、作品证据 accepted、掌握确认、下一阶段 route_revision 采纳。
- 打开 `/learn`，检查 `NextStagePlan`、3 个正式下一阶段活动、Learning Situation-first / runtime fallback / 10-15 分钟 rubric 文案。
- 检查无 framework error overlay 和浏览器异常。
- 保存截图：`docs/learn-next-stage-rubric.png`。

### 作品级主链路验收（portfolio full loop）

运行：

```bash
npm run acceptance:portfolio
```

前置：dev server 已启动（`npm run dev`，默认 `http://127.0.0.1:5174`，可用 `TRELLIS_BASE` 覆盖）；本机装有 Chrome 或 Edge（可用 `CHROME_PATH` 指定）。

该脚本覆盖完整作品级主链路：

1. `reset` owner → 页面表单提交诊断（React 受控表单经 CDP 填写目标、偏好与资料）。
2. 提案视图验证：`完整阶段路径`（StagePath）与 `前三周动态演示`（DynamicSimulation）面板渲染；截图 `docs/acceptance-portfolio-stage-path.png`。
3. API 闭环：`confirm` → 生成作品任务（AI Agent 产品 PRD v1）→ `start` → 提交 hard evidence → `review`（accepted）→ `confirm-mastery` → 采纳下一阶段 `route_revision` 调整 → `NextStagePlan` + 3 个正式活动。
4. 质量与评测：`GET /api/learning/quality`（作品任务/证据/下一阶段/tools/rule fallback）、`POST /api/learning/eval`（passRate = 1）、`POST /api/learning/mastra-runtime`（StagePath durationWeeks ≥ 6、DynamicSimulation adjustments ≥ 4、workflow trace ≥ 10）。
5. 确认视图验证：`/learn` 渲染 `NextStagePlan`、`已生成 3 个正式活动`、rubric 文案、作品级质量面板；点击 `运行 eval`（`100% pass`）与 `运行 Mastra runtime`（`week StagePath`）；检查无 error overlay / 浏览器异常。
6. 截图：`docs/acceptance-portfolio-next-stage.png`。

两脚本均无 npm 依赖（Node 原生 fetch / WebSocket + Chrome DevTools Protocol），`acceptance-portfolio-full-loop.mjs` 复用 `acceptance-next-stage-rubric.mjs` 导出的 CDP / API helpers。

## 已知边界

- 当前已有 `src/mastra/index.ts` 与 npm scripts（已 pin `mastra@1.27.0`）；Studio 可通过 `npm run mastra:dev` 启动（dev server 自带 Studio，`http://localhost:4111`），`npm run mastra:studio` 是可选独立 UI；换机后首次运行需下载 CLI 包。
- 当前 workflow demo 不写正式学习状态；正式状态写入由 `/api/learning/artifact` 和学习活动 API 承担。
- Artifact loop 已有正式闭环切片：生成 AI Agent 产品 PRD v1 `integrated_task`、提交作品 evidence、评审通过后进入掌握确认，并在用户确认掌握后提出下一阶段路线建议；采纳该建议后会展示作品集包装阶段 `NextStagePlan`，并生成三个带 rubric 的正式活动。尚未完成多轮作品迭代和完整阶段版本管理。
- 10-step workflow 是作品级 runtime demo，不是完整 durable production agent runtime；持久状态仍由 Trellis service/D1 承担，runtime report 通过 `resumeContract` 明确 HITL/API 恢复边界。
- 无 API key 时仍用规则版 fallback；这正是作品集要强调的生产思维：关键判断可降级运行。
