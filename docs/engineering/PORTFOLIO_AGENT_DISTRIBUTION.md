# Trellis 作品级并发开发分发说明

> 日期：2026-08-28
> 用途：给后续 coding agent 接手时快速判断“哪些已完成、哪些不能碰、下一步做什么”。
> 当前目标：把 Trellis 整理成可展示、可验证、可分发的 Agentic Learning Companion 作品级原型。

## 1. 当前可讲状态

Trellis 已经从普通学习计划工具推进到作品级 AI-native demo：

```text
Learning Situation-first
→ Material Fit
→ Capability Signal
→ Stage Path
→ Dynamic Adjustment
→ Artifact Task
→ Evidence-to-Mastery
→ HITL Confirmation
→ Next Stage Plan
→ Eval / Monitor / Trace
```

核心原创点不是“多 agent 数量”，而是学习过程里的动态判断：目标、资料、时间精力、行为、证据和作品质量变化时，系统能给出可解释调整，并保留规则 fallback。

## 2. 已完成模块

| 模块 | 状态 | 关键文件 |
|---|---|---|
| Learning Situation-first demo surface | 已接入 `/learn` | `app/learn/page.tsx`、`app/v02.css` |
| StagePath / DynamicSimulation | 已有领域模块与 UI 展示 | `lib/learning/agents/stage-path-planner.ts` |
| Artifact loop / NextStagePlan | 已有作品任务、掌握确认、下一阶段建议 | `lib/learning/agents/next-stage-planner.ts`、`app/api/learning/artifact/route.ts` |
| Artifact iteration read model | 已有作品状态、修订轮次、版本历史、缺失 rubric、下一步动作 | `lib/learning/agents/next-stage-planner.ts`、`app/learn/page.tsx` |
| Mastra runtime wrapper | 已可运行，不推翻 domain engine | `lib/learning/agents/mastra-workflow.ts`、`src/mastra/index.ts` |
| Quality / Eval / Memory / Tool registry | 已有 API 和测试 | `app/api/learning/quality/route.ts`、`app/api/learning/eval/route.ts`、`lib/learning/architecture/` |
| Rubric-aware Evidence Review | 已接入评审主链路 | `lib/learning/agents/evidence-evaluator.ts`、`lib/learning/agents/types.ts` |
| Browser acceptance | 已有可复现截图与验收 | `scripts/compatibility/acceptance-next-stage-rubric.mjs`、`scripts/compatibility/acceptance-portfolio-full-loop.mjs` |
| Portfolio docs | 已有 README、讲稿、截图索引、发布清单 | `README.md`、`docs/product/`、`docs/engineering/` |

## 3. 必跑验收

```bash
npm run build
npm run test
npx tsc --noEmit --incremental false
node --test --test-isolation=none "tests/learning-domain/*.test.ts"
npm run lint
npm run demo:mastra
npm run acceptance:next-stage
npm run acceptance:portfolio
npm run release:check
```

当前最近一次结果：

- `npm run build`：通过，包含 Sites artifact 校验。
- `npm run test`：6/6 通过。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"`：190/190 通过。
- `npm run lint`：通过。
- `npm run demo:mastra`：通过，输出 10 步 workflow trace。
- `npm run acceptance:next-stage`：通过。
- `npm run acceptance:portfolio`：通过，包含 12/12 eval、Mastra runtime、NextStagePlan、作品迭代状态、修订轮次和版本历史。
- `npm run release:check`：通过，213 个公开候选文件、20 个必需文件、敏感命中 0。

## 4. 分发边界

- 不要公开 `memory/`：其中含个人记忆、会话、账号/路径线索。
- 不要把 Trellis 宣称为完整 autonomous agent：当前是 Mastra workflow runtime + Trellis domain engine + HITL/fallback 的作品级原型。
- 不要推翻现有 domain engine：Mastra 只是 workflow/runtime/Studio 展示层，学习判断仍由 Trellis 规则模块承载。
- 不要新增泛领域学习平台能力：作品集场景固定为 AI PM 转型启动阶段。
- 不要用未验证的 LLM 行为当验收标准：无 API key 时必须能靠规则 fallback 跑通。

## 5. 下一批适合分发的任务

1. **Release branch / public package**
   - 建一个干净发布分支或白名单打包。
   - 排除 `memory/`、`.wrangler/`、`.sites-runtime/`、临时浏览器 profile。
   - 确认 `README.md` 引用的文档和截图全部纳入版本控制。

2. **Docs consistency sweep**
   - 统一旧 V0.2 文档和作品级文档的说法。
   - 把“bash/WSL 构建风险”更新为“npm 脚本已跨平台”。
   - 明确 Artifact loop 哪些是正式数据流，哪些仍是 demo/runtime 展示。

3. **Mastra Studio verification**
   - 复跑 `npm run mastra:dev`。
   - 用 `scripts/legacy/mastra-studio-shot.mjs` 更新 Studio 截图。
   - 确认截图中能看见 workflow graph、steps、runs/traces。
   - 注意：`/api/learning/mastra-runtime` 已返回 `stepOutputs`、`hitlCheckpoints`、`resumeContract` 和 `runtimeReadiness`；不要重复另造 runtime report。

4. **Public hygiene pass**
   - 参数化旧 Python acceptance 脚本中的本地绝对路径。
   - 脱敏或排除含个人 handle / workers.dev / 邮箱的旧 runbook。
   - 复跑敏感扫描。

5. **Artifact loop hardening**
   - 当前已有作品任务、作品证据、掌握确认、下一阶段建议和 `artifactIteration` 读模型。
   - `npm run acceptance:portfolio` 已直接断言 `/api/learning/artifact` 可读出迭代状态、修订次数和版本历史。
   - 下一步是增加正式 artifact version 存储字段和多阶段路线版本管理，减少 demo 专用路径。

6. **Portfolio delivery manifest**
   - 当前已有 `docs/engineering/TRELLIS_PORTFOLIO_DELIVERY_MANIFEST.md`。
   - 下一步是基于 manifest 生成公开发布包或公开分支，不要把 `memory/` 纳入发布。

## 6. 推荐合并顺序

1. 先合并核心代码与测试：`lib/`、`app/api/learning/`、`app/learn/page.tsx`、`app/v02.css`、`tests/learning-domain/`。
2. 再合并 runtime/scripts：`src/mastra/`、`scripts/*.mjs`、`package.json`、`package-lock.json`、`vite.config.ts`、`eslint.config.mjs`。
3. 再合并作品集文档和截图：`README.md`、`docs/product/`、`docs/architecture/`、`docs/engineering/`、`docs/*.png`。
4. 最后处理私有记忆：`memory/` 只进私有仓库，不进公开发布包。
