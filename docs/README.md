# Trellis 文档索引

## 一周投递版（2026-09-06 启动）

- [交付台账与人工观察提纲](product/TRELLIS_WEEK_DELIVERY.md)
- [岗位校准与理想服务样本](product/TRELLIS_WEEK_RESEARCH.md)
- [验证结果与失败证据](product/TRELLIS_WEEK_VALIDATION.md)
- [作品集案例与面试讲述](product/TRELLIS_WEEK_CASE_STUDY.md)
- [8 页面试展示稿](portfolio/week-delivery/Trellis-AI-PM.html)、[PDF](portfolio/week-delivery/Trellis-AI-PM.pdf)、[可编辑 PPTX](portfolio/week-delivery/Trellis-AI-PM.pptx)
- [自动演示视频（预置测试用户，无配音）](portfolio/week-delivery/Trellis-demo.webm)

当前为受控演示及作品集初稿；真实用户观察、独立评分、长期效果和商业验证尚未完成。

文档按“当前契约、工程运行、历史兼容、归档”解释。文件仍存在不代表它仍定义产品；状态以本索引和 `memory/handoff/current.md` 为准。

## 当前产品契约

- `product/TRELLIS_COURSE_INTELLIGENCE_PRODUCT_CONTRACT.md`：当前 Course Intelligence 产品责任、用户链路与边界。
- `product/TRELLIS_HIGH_TRUST_REFERENCE_BASELINE.md`：学习处境编排重构的高可信机制、工具与跨界产品参考基线。
- `product/TRELLIS_INTERNAL_TEST_PLAN.md`：中高级作品集内测剧本、通过标准与记录模板。
- `product/TRELLIS_INTERNAL_TEST_LOG.md`：内部测试观察记录。
- `product/TRELLIS_PORTFOLIO_EVIDENCE_MATRIX.md`：作品集主张、产品证据、工程证据与内测观察矩阵。
- `architecture/TRELLIS_COURSE_INTELLIGENCE_ARCHITECTURE.md`：来源、领域图、Course Genome、课程组合与学习状态架构。
- `architecture/TRELLIS_ARCHIFY_DIAGRAMS.md`：Archify 图源说明、功能架构、技术架构和关键学习时序。
- `architecture/archify/`：Archify typed JSON IR、已交付 HTML、浏览器 visual-check 回执与截图。
- `architecture/ADR_MASTRA_D1_RESPONSIBILITIES.md`：正式工作流与业务状态的责任划分。
- `engineering/TRELLIS_REMEDIATION_IMPLEMENTATION_2026-08-31.md`：本地功能 MVP 的 Conditional Go 状态与生产缺口。
- `engineering/TRELLIS_FULL_ENGINEERING_AUDIT_2026-08-30.md`：全仓审计依据与风险底稿。

## 当前工程入口

- `engineering/LOCAL_DEVELOPMENT.md`：本地环境、迁移与验证。
- `engineering/DEPLOYMENT_RUNBOOK.md`：远程 D1、环境变量、部署与 smoke。
- `engineering/TRELLIS_DEPLOYMENT_DECISION.md`：Cloudflare Workers + D1、Vercel、GitHub Pages 的阶段性取舍。
- `development/REPOSITORY_STRUCTURE.md`：目录职责和可重建边界。
- `../scripts/README.md`：正式、兼容与历史脚本分类。
- `architecture/MEMORY_ARCHITECTURE.md`：长期记忆分层与写入协议。

## 交付材料

- `product/TRELLIS_PORTFOLIO_CASE_STUDY.md`：当前作品集叙事草案。
- `engineering/TRELLIS_3_MIN_DEMO_SCRIPT.md`：Course Intelligence 三分钟演示。
- `architecture/TRELLIS_DELIVERY_ARCHITECTURE.md`：交付视角的功能与技术架构。
- `acceptance-course-intelligence-*.png`：由正式浏览器验收生成的当前截图。
- `acceptance-internal-test-*.png`：由内部测试闭环验收生成的作品集补充截图。

## 历史兼容

以下材料记录 StagePath、Evidence Review、Mastra 和旧作品闭环，仍可用于回归或理解演进，但不定义当前首次体验：

- `product/TRELLIS_V0.2_PRD.md`
- `product/TRELLIS_V0.3_EVIDENCE_REVIEW_ENGINE.md`
- `product/TRELLIS_PORTFOLIO_AGENTIC_LEARNING_COMPANION.md`
- `engineering/TRELLIS_MASTRA_WORKFLOW_RUNBOOK.md`
- `engineering/TRELLIS_PORTFOLIO_DELIVERY_MANIFEST.md`
- `engineering/PORTFOLIO_AGENT_DISTRIBUTION.md`

## 归档

- `archive/legacy-v0.1/`：Trellis 定名与 V0.2 方向确认前资料。
- `archive/v0.2-drafts/`：正式 V0.2 PRD 之前的提案。
- `archive/2026-08-13-mvp-proposals/`：早期 MVP 候选方案。

归档内容只用于追溯。实施前先读当前产品契约、架构、remediation 状态和当前交接。
