# 2026-08-28 Phase 3/4 Runtime Delivery

## 本轮目标

继续 Phase 3/4：把 Mastra runtime 从普通 trace demo 推进到作品级可讲的 workflow runtime report，并把公开交付包入口收敛成 manifest。

## 已完成

### Phase 3：Mastra runtime report 厚实化

- `runTrellisMastraWorkflowDemo` 返回值新增：
  - `stepOutputs`：每步完成状态、HITL 标记、摘要和输出字段；
  - `hitlCheckpoints`：HITL 节点、决策要求、状态写入策略和恢复 API；
  - `resumeContract`：说明通过 Trellis API 状态机恢复，而不是静默写状态；
  - `runtimeReadiness`：说明 runtime 可执行、可观察、规则 fallback、持久状态归属和生产缺口。
- `/api/learning/mastra-runtime` 的 `GET` 注册状态更新为：
  - `cliScriptConfigured: true`
  - `studioScriptConfigured: true`
  - 明确 Studio 可通过 npm scripts 启动，自动验收以 API/browser acceptance 为准。
- `/learn` 的 Mastra runtime 面板新增展示：
  - readiness；
  - resume contract；
  - HITL checkpoints；
  - step output keys。
- `scripts/acceptance-portfolio-full-loop.mjs` 新增验证：
  - runtime GET 已注册；
  - Studio scripts 已配置；
  - stepOutputs 可读；
  - hitlCheckpoints 可读；
  - resumeContract 可读；
  - runtimeReadiness 可读。

### Phase 4：作品交付 manifest

- 新增 `docs/engineering/TRELLIS_PORTFOLIO_DELIVERY_MANIFEST.md`：
  - 产品交付目标；
  - 可运行入口；
  - runtime 能力；
  - 可截图证据；
  - 必须通过的验收；
  - 可公开/不可公开范围；
  - 不能夸大的边界；
  - Phase 3/4 后续开发入口。
- `docs/README.md` 增加 manifest 索引。
- `scripts/portfolio-release-check.mjs` 将 manifest 加入 required 文件。
- 更新：
  - `docs/engineering/TRELLIS_MASTRA_WORKFLOW_RUNBOOK.md`
  - `docs/product/TRELLIS_PORTFOLIO_AGENTIC_LEARNING_COMPANION.md`
  - `docs/engineering/PORTFOLIO_AGENT_DISTRIBUTION.md`

## 验证结果

- `npx tsc --noEmit --incremental false`：通过。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"`：190/190 通过。
- `npm run lint`：通过。
- `npm run acceptance:portfolio`：通过，覆盖 runtime GET/POST、resume contract、readiness、HITL checkpoints、artifact API、quality、eval、browser UI。
- `npm run release:check`：通过，required 21/21，敏感命中 0。
- `npm run build`：通过；仍有依赖 `gray-matter` direct eval 警告和构建插件耗时提示，非本轮引入。
- `npm run demo:mastra`：通过，输出 runtime report 新字段。

## 当前判断

Phase 3/4 已达到作品级可讲状态：

- Phase 3 不是完整 durable production orchestration，但已经有可执行 Mastra workflow、run report、HITL checkpoints、resume contract 和 readiness 边界。
- Phase 4 已有公开交付 manifest、release check、截图索引和验收脚本；下一步可以进入公开发布包/分支整理。

## 下一步

1. 若继续 Phase 3：把 runtime report 写入正式 run history（DB/内存 store）并增加失败 run、人工拒绝 run、fallback run 样例。
2. 若继续 Phase 4：基于 manifest 生成公开发布包或公开分支，排除 `memory/`，并更新 Mastra Studio 截图。
3. 若继续产品闭环：实现正式 artifact version 数据模型，减少 demo 专用路径。

## 注意

- 未修改 `memory/handoff/current.md`，该文件此前存在无效 UTF-8 风险。
- 当前工作区仍包含大量并发任务产物，合并前需要统一 review。
