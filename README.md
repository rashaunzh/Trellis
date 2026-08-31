# Trellis

Trellis 是一个课程智能与学习编排系统。它把用户目标和已有课程转化为有限课程组合、准确章节顺序、退出条件和可持续学习状态。

它不以“再推荐更多课程”为目标，而是回答：

- 这个目标涉及哪些知识，哪些不在当前范围；
- 一门课程真正覆盖什么，要求什么前置，讲到什么深度；
- 哪门课程承担主线，哪些只学部分章节，哪些延后或跳过；
- 本次从哪一节开始，学到哪里可以停止；
- 课程测试或轻量反馈说明了什么，后续应该继续、回看、补前置还是重算。

正式主链路：

```text
目标与已有课程
-> 发布领域图
-> Course Genome 与章节节点映射
-> 个人课程组合
-> 用户确认
-> 准确章节活动
-> 学习反馈与连续状态
```

## 当前实现

- 10 个代表来源、30 门课程或专业参考、36 个 AI 领域节点；
- DeepLearning.AI、Microsoft Learn、Anthropic、LangChain、Stanford、MIT、Duke、NIST 和专业书籍等公开目录基线；
- 课程版本、章节、来源快照、映射、分析任务和个人方案的 D1 存储；
- 内置 OpenAI-compatible 模型网关：结构化输出、Zod 校验、超时、有限重试、缓存和调用记录；
- 无模型 Key 时使用已发布基线，陌生课程明确显示尚未分析；
- 课程目录范围约束：用户给出 DeepLearning.AI 总目录时，系统先在该目录内取舍，不静默混入其他平台；
- `/learn` 三态流程：说明目标、检查方案、开始准确章节；
- `/grow` 长领域图与当前路线投影；
- `/workbench` 仅管理工具、外部知识库和临时内容；
- 旧周计划、活动、学习反馈和 owner 隔离继续复用，旧固定路线退出正式入口。

## 本地运行

```bash
npm ci
npm run dev
```

Vite 会打印实际地址。首次运行或 schema 更新需先应用 `drizzle/0013_course_intelligence.sql`，详见 [本地开发指南](docs/engineering/LOCAL_DEVELOPMENT.md)。

内置模型为可选增强：

```bash
TRELLIS_AI_API_KEY=<server-key>
TRELLIS_AI_MODEL=<model-name>
TRELLIS_AI_BASE_URL=<optional-openai-compatible-base-url>
```

没有这些变量时，已发布课程和路线仍可使用。BYOK 不解锁基本能力，只用于指定模型、更高额度或未来私有材料分析。

## 验证

```bash
npx tsc --noEmit --incremental false
node --test --test-isolation=none "tests/learning-domain/*.test.ts"
node --test tests/*.test.mjs
npm run lint
npm run build

# 启动 dev server 后，按实际端口设置 TRELLIS_BASE
TRELLIS_BASE=http://127.0.0.1:5177 npm run acceptance:course-intelligence
npm run delivery:precheck
```

浏览器验收覆盖“目标 → DeepLearning.AI 目录内取舍 → 确认 → 准确章节 → 领域图 → 辅助工作台”，并生成 `docs/acceptance-course-intelligence-*.png`。

## 核心接口

- `GET /api/learning/intelligence/state`
- `POST /api/learning/intake`
- `POST /api/learning/materials/analyze`
- `GET /api/learning/curricula/:id`
- `POST /api/learning/curricula/:id/confirm`

抓取、候选图发布和批量更新保持为内部流程，不暴露无鉴权管理 API。

## 边界

- 当前仍是匿名 owner MVP，不是完整账号与权限系统；
- 不复制付费课程正文，只保存公开目录、元数据、映射和来源引用；
- 首批基线是可审计起点，不代表已经覆盖全部 AI 课程；
- 课程变化只生成候选版本和影响报告，不自动改写已确认路线；
- 旧 Mastra、Eval、固定 StagePath 和作品闭环仍保留兼容代码，但不再定义正式产品体验。

## 文档

- [Course Intelligence 产品契约](docs/product/TRELLIS_COURSE_INTELLIGENCE_PRODUCT_CONTRACT.md)
- [Course Intelligence 架构](docs/architecture/TRELLIS_COURSE_INTELLIGENCE_ARCHITECTURE.md)
- [复用与重建审计](docs/engineering/TRELLIS_REUSE_AND_REBUILD_AUDIT.md)
- [本地开发指南](docs/engineering/LOCAL_DEVELOPMENT.md)
- [部署 Runbook](docs/engineering/DEPLOYMENT_RUNBOOK.md)
- [当前交接状态](memory/handoff/current.md)
