# 当前接力

更新时间：2026-08-14

## 当前目标

在 GitHub 仓库 `rashaunzh/AI-Learning-OS` 的当前分支 `docs/trellis-v02-adaptive-learning-prd` 上推进 Trellis V0.2 MVP。当前阶段已经完成 Checkpoint 5，并补齐产品交付物：PRD、产品介绍、MVP 交付说明和可交互产品网页。

本轮浏览器自动化验收由另一条任务负责；当前接力不把浏览器验收写成已完成。

## 已确认的产品与工程基线

- 产品正式名称是 **Trellis**。
- 核心价值是：**可信的动态学习编排**。
- 前台一级功能固定为 **学习 / 成长 / 工作台**，不再使用“继续学习 / 学习路径 / 复习评估 / 资源库”四页面结构。
- 学习地图和个人成长树是同一张图的两层表达，不拆成两个功能。
- 默认按周推进，不做今日活动、每日排程、打卡或独立“继续学习”。
- 节点主状态为 `unstarted` / `growing` / `validated`。活动完成不直接验证节点，证据 accepted 后才可能触发节点验证。
- 允许跳学，但必须通过证据验证；暴露前置缺口时再插入补强活动。
- 活动高动态，周计划半稳定，长期路径版本化；改变主路径或核心能力判断必须由用户确认。
- MVP 不建设内嵌自研 agent runtime，只保留 planner、activityComposer、evidenceEvaluator、adjustmentAdvisor 四类可替换接口。

## 交付源

- GitHub 当前分支 `docs/trellis-v02-adaptive-learning-prd` 是唯一交付源。
- 本地 clone 只是工作区；不要把任何盘符路径写成长期唯一源。
- 会话开始前拉取，结束后按需提交和推送；冲突时停止，不得覆盖另一台设备的工作。

## 当前进度

- [x] Phase 0：文档与交接修复。
- [x] Phase 1：领域模型与数据结构。
- [x] Phase 2：后端 API 与 workspace 读取模型。
- [x] Phase 3：学习 / 成长 / 工作台三功能前端。
- [x] Phase 4：活动抽屉闭环、证据退回/修订/接受、节点证据驱动变色、调整建议确认。
- [x] Phase 5：D1 持久化、重启恢复、全量测试与构建验证。
- [x] 交付整理：新增 `docs/product/TRELLIS_V0.2_MVP_DELIVERY.md`，明确最终验收口径、MVP 交付说明、产品复盘和下一阶段计划。
- [x] 产品介绍：新增 `docs/product/TRELLIS_PRODUCT_INTRODUCTION.md`，面向协作者、潜在用户和产品评审者。
- [x] 可交互产品网页：新增 `/product`，包含价值主张、三功能结构、互动周计划演示、核心闭环切换、证据驱动节点变色演示，并可跳转 `/learn`、`/grow`、`/workbench`。
- [x] 产品页 UI 调整：缩小 `/product` 首屏标题和品牌区，修复导航 logo 文本溢出。
- [x] 本地交互页修复：对当前 Miniflare D1 应用 `drizzle/0004` 与 `drizzle/0005`，解决 `/learn` 报 `D1_ERROR: no such table: learning_routes`；开发文档已补本地 D1 初始化命令。
- [x] 产品体验修复（本轮）：每周时间上限 6h→20h；规划器一个节点拆多个活动（按容量，上限 8 核心）；学习页周看板 + 容量统计 + 活动抽屉交互（步骤勾选/笔记/自检/证据类型/外部链接）；成长页中文节点名、相邻分支、主动调整表单；新增 `POST /api/learning/adjustments/propose`；工作台收集箱 + 资源加入 + 工具本周使用 + AI 接入说明。

## 最近验证证据

本机（trellis-cleanup）复跑（2026-08-14 体验修复轮）：

- `npm run test`：6/6 通过，含 build 与 Sites artifact 校验。
- `npm run test:domain`：41/41 通过（相邻分支测试已随 ai-literacy 行为变更更新）。
- eslint（app + lib，排除 dist/.next）：0 problems。
- 浏览器 UI 验证（Playwright，真实 Chromium，8h 容量新用户）：16/16 通过——时间选项含 20h、周看板 18 个活动、抽屉 5 项交互、成长页中文/相邻分支/调整表单、工作台收集箱/资源/工具、AI 接入说明。
- `POST /api/learning/adjustments/propose` → proposed → confirm → accepted 全链路验证通过。

更早的验证（交付整理轮，用户 2026-08-14 提供）：

- `npm run test`：6/6、`npm run test:domain`：41/41、`npm run lint`：0 problems、`git status`：干净，HEAD `2285092`。
- `/product`、`/learn` 返回 200；`/api/learning/workspace` 返回 200，不再报缺表；产品页 TSX eslint 通过，`vinext build` 通过。

## 重要文档入口

- `docs/product/TRELLIS_V0.2_PRD.md`：当前产品基线。
- `docs/product/TRELLIS_PRODUCT_INTRODUCTION.md`：产品介绍。
- `docs/product/TRELLIS_V0.2_MVP_DELIVERY.md`：Checkpoint 5 后的交付、验收、复盘和下一阶段计划。
- `/product`：可交互产品介绍网页。
- `docs/architecture/TRELLIS_V0.2_ARCHITECTURE.md`：学习编排内核架构。
- `docs/engineering/TRELLIS_V0.2_IMPLEMENTATION_PLAN.md`：Phase 0–5 实施计划。
- `memory/decisions/2026-08-12-v0.2-adaptive-learning.md`：V0.2 自适应学习方向。
- `memory/decisions/2026-08-13-v0.2-mvp-scope.md`：MVP 不止于路径确认的范围决策。

## 尚未完成 / 开放问题

- 浏览器自动化验收已由本任务完成（Playwright 16/16），证据见"最近验证证据"。
- 旧 D1 状态不会自动重排：已确认的旧周计划保持原样。用户如需看到新编排效果，需重新诊断或后续补"重排本周"入口（本轮未加，建议下一步优先）。
- Sites 保存/部署需要基于已推送 commit；如本轮已提交推送新页面，后续可保存站点版本并部署生产 URL。
- 本地 D1 数据只存在于当前机器 `.wrangler/state`；新机器首次打开交互页前如遇缺表，按 `docs/development/LOCAL_DEVELOPMENT.md` 的“本地 D1 初始化”执行迁移。
- 综合情境任务正式提交、AI 多维评分、用户确认掌握、延迟复测自动调度仍是下一阶段 P0。
- AI 通识 V1 的完整来源目录、节点量规、可信度审计仍需补齐。
- 工作台资源映射已具备骨架，但外部材料自动同步和摘要卡片仍需深化。
- 旧 V0.1 实现仍保留为兼容层，未来需要明确清理或迁移策略。
- 生产部署、远程 D1 迁移、备份和环境变量管理另行确认。

## 精确下一步

1. 提交推送本轮体验修复（核心文件 + 测试更新 + memory），不要 `git add .`。
2. 若用户放行，最优先补"重排本周 / 重新诊断"入口——否则旧状态测试时无法看到新编排效果。
3. 进入下一阶段 P0：
   - 综合情境任务正式提交流；
   - AI 多维评分与用户确认掌握；
   - 延迟复测候选与复核状态；
   - AI 通识 V1 内容包来源与量规审计。
