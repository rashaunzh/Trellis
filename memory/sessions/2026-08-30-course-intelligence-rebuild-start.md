# Course Intelligence 重构启动

## 本轮目标

停止继续扩展现有展示型学习界面，先建立 Trellis 新产品中心的可执行契约：领域/课程智能、课程取舍、章节映射、退出条件和发布门槛。

## 已确认判断

- Trellis 对学习编排决策负责，不是课程推荐器、日程拆分器或完整 AI 教师。
- 领域图和章节到知识节点映射是 Trellis 内置能力，不由用户设计。
- AI 负责开放语义判断；确定性系统负责 schema、版本、约束、发布和历史。
- 内置 AI 是核心产品能力；BYOK 只是额度、模型和数据边界选项。
- 第一条 benchmark 使用 DeepLearning.AI 目录与 AI PM 产品判断目标，要求压缩课程，而不是全部推荐。

## 持久结果

- 新增 `lib/learning/intelligence/course-intelligence.ts`：
  - `CourseGenome`；
  - 章节到知识节点映射；
  - 课程角色 `anchor / selected_units / supplement / defer / exclude`；
  - 分阶段课程组合；
  - `CourseIntelligencePort`；
  - 确定性发布检查 `evaluateCurriculumAssembly()`。
- 新增 `tests/learning-domain/course-intelligence.test.ts`：DeepLearning.AI 五门代表课程 golden benchmark，并验证局部采用必须指定章节、阶段章节必须有知识映射。
- 新增产品契约 `docs/product/TRELLIS_COURSE_INTELLIGENCE_PRODUCT_CONTRACT.md`。
- 新增复用审计 `docs/engineering/TRELLIS_REUSE_AND_REBUILD_AUDIT.md`。

## 验证

- `npx tsc --noEmit --incremental false`：通过。
- `npx eslint lib/learning/intelligence/course-intelligence.ts tests/learning-domain/course-intelligence.test.ts`：通过。
- Course Intelligence 新增测试：3/3 通过。
- 完整领域测试：203/203 通过。

## 边界与下一步

本轮没有接入模型、真实目录抓取、数据库和前端，也没有把 benchmark 示例写入正式用户状态。下一步是实现内置模型网关的结构化课程解析，再建立来源快照、课程版本和 DeepLearning.AI 公开目录采集；模型输出必须先通过本轮发布检查才能进入候选内容包。
