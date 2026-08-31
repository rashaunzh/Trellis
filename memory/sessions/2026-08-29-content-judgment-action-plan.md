# 2026-08-29 内容判断与行动卡重设计

## 背景

用户重新校准 Trellis 的产品重心：当前 MVP 只专注 AI / AI PM 初学，不优先做泛课程推荐、作品集包装或重型作业系统。核心问题不是“推荐更多课”，而是帮助用户判断内容专业性、整合材料、拆出本周最值得推进的几步，并以轻反馈观察理解。

## 本次实现

- `LearningApplicationService.getWorkspace()` 新增并返回 `contentJudgment`、`weeklyActionPlan`、`nextAction`、`conceptHints`、`learningOutputs`。
- `contentJudgment` 从现有内容包、用户资源、材料评审和本周活动输入推导材料角色：本周主线、只作参考、后续再用、暂不碰。
- `weeklyActionPlan` 将底层活动转成用户可理解的行动卡：行动类型、为什么现在做、只看哪段材料、30 分钟起步且 15 分钟递增、卡住时如何缩小。
- 新增轻量 `ScenarioQuestion`，用四选一情景判断降低“提交证据像做作业”的负担；提交后仍走正式 Evidence Review。
- `learningOutputs` 将 accepted / needs_revision 的判断、产出和进展记录投影为连续周复盘输入。
- `/learn` 首屏从作品展示优先改为本次最小推进、本周行动卡、材料取舍和学习产出；作品闭环保留但不作为默认学习目的。
- 启动页文案从“作品路径”改为“AI PM 入门 / 内容判断 / 本周取舍”；时间选项改成粗颗粒度。
- 材料判断读模型对同名同内容用户资源去重，避免工作台/验收重复材料污染学习页面。
- 更新 `docs/product/TRELLIS_DAILY_USABLE_2_0.md`，记录外部 AI API 是增强而非地基：正式状态仍由 Trellis 结构化服务和规则 fallback 保底。

## 验证

- `npx tsc --noEmit --incremental false` 通过。
- `npm run lint` 通过。
- `npm run build` 通过；仍有 `gray-matter` 依赖 direct eval 的既有构建警告。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"` 通过，197/197。
- `node --test tests/*.test.mjs` 通过，6/6。
- `npm run acceptance:three-week-loop` 通过，并更新截图：
  - `docs/acceptance-three-week-learn.png`
  - `docs/acceptance-three-week-review-history.png`
  - `docs/acceptance-three-week-artifact-loop.png`

## 当前边界

- 行动卡和材料判断目前是 workspace 读模型，不新增 schema。
- 情景题是规则模板生成，还未结合具体课程段落生成长选项或更细场景。
- 外部 AI API 已有评审增强配置，但本轮没有扩大到课程全文解析；仍避免把能否使用 Trellis 绑定到用户自带 tokens。
- 当前内容池仍偏粗，需要下一轮做 AI / AI PM 内置课程目录、专业性判断标准和节点映射深化。
- 旧的作品级区块仍在页面下半部分，后续 UI 轮次应继续降噪。

## 下一步

1. 深化 AI / AI PM 内容池：把 Trellis 自带好课程切成可引用片段，补每段的专业性依据、适配节点和建议使用方式。
2. 强化 action card 生成：避免同节点活动标题重复，按“看片段 / 做判断 / 拆案例 / 小模板 / 复盘”形成更清晰节奏。
3. 把情景判断从模板升级为课程片段相关的深选项，但保持一键提交和低启动。
4. 修跨周 action API 返回 workspace 默认周的问题，让 start/evidence/review 都返回活动所属周视图。
5. UI 收尾时继续把系统状态、作品级质量和 Mastra 展示折叠到工程展示层。

## 追加实现：内容池切片补强

- `ResourceMapping` 新增可选字段：`segmentFocus`、`qualityRationale`、`skipGuidance`、`learnerAction`。
- AI / AI PM 内置资源映射已补充片段级判断，覆盖 Google ML Crash Course、NIST AI RMF、Gemini Prompting、OpenAI Evals、NIST AI 600-1 和工具调用文档。
- `contentJudgment` 会优先使用 `segmentFocus` 作为推荐片段，展示 `qualityRationale` 与 `learnerAction`。
- 行动卡标题改成学习节奏表达：先搞懂、看例子、做一版、判断题、收个口、小框架、复测。
- 情景判断四个选项加长，表达“继续补课 / 先做判断 / 换更难材料 / 只收藏”四种常见学习状态。
- 新增测试保护资源映射切片字段、行动卡标题节奏和情景选项上下文长度。
- 验证：`npx tsc --noEmit --incremental false`、`npm run lint`、`npm run build`、领域测试 198/198、`npm run acceptance:three-week-loop` 均通过。
