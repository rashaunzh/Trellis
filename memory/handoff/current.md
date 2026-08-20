# 当前接力

更新时间：2026-08-20

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
- [x] 旧状态体验补洞（2026-08-20）：新增温和重排本周 `POST /api/learning/replan` 与学习页“重排本周”按钮；保留已产生证据、已完成活动和节点进度，只替换本周未产生证据的开放活动；“重新设置”继续作为硬清空入口。
- [x] AI 接入从说明推进到最小配置：工作台支持 OpenAI 兼容 `base_url`、API Key、model 与启用开关；API Key 只保存在服务端配置表，前端仅显示脱敏状态；未配置时回退规则版评估。
- [x] 重排本周浏览器验收（2026-08-20）：新增 `scripts/acceptance-replan.py`，32/32 通过；证据/节点/支持证据列表保留、未产生证据活动被替换、新活动出现、状态未清空，可作为演示版本。
- [x] 工程可用 MVP 轮验证（2026-08-20）：

- `npm run test:domain`：51/51（+2 内容包字段完整性/缺失抛错）。
- eslint 0 problems；`vinext build` 通过（路由含 resources/inbox，旧路由 progress/content 已移除）；`node --test tests\*.test.mjs` 6/6（rendered-html 改验 build 产物路由）。
- `scripts/acceptance-v02-main-flow.py`：13/13（新用户→6h 计划 core6/total8→抽屉 6 段→短证据退回→修订通过→节点 validated→重排证据 2=2 保留→多 owner 隔离→reset 只清当前）。
- 收集箱端到端：无 profile 可读写、刷新持久化、多 owner 隔离。
- `scripts/acceptance-replan.py`：32/32 回归通过。

部署前检查（2026-08-20）：`.openai/hosting.json` 有 project_id 可复用；远程 D1 `trellis-v02-d1` 已建但迁移从未应用（num_tables=0）；`dist/server/wrangler.json` 是 placeholder 需 `DATABASE_ID` 重新 build；无敏感信息入库。
- [x] P0 工程任务计划（2026-08-20）：产出 `docs/engineering/TRELLIS_V0.2_P0_PLAN.md`——综合情境任务（复用 activity + synthesis_task subtype）、掌握确认（pending_confirmation + 复用 adjustments）、延迟复测（复测元数据列 + retest 活动），含数据模型/API/前端/测试/实施顺序/Checkpoint。
- [x] 工程可用 MVP（2026-08-20，Phase A–G 收尾）：内容样本接入（AI-For-Beginners，7 中文节点 + sourceRefs 可点击 + 量规 + 模板）；planner 6 类活动（45/45/90/30/30/120 拆单，6h→核心 360/360）；抽屉 6 段（为什么学/学什么/步骤/输出/自检/提交）；工作台收集箱持久化（learning_user_resources + /api/learning/resources/inbox，独立于学习状态）；删除 V0.1 旧接口（progress/proposal/content）；.gitignore；4 份工程文档（API_CONTRACT/STATE_MACHINE/LOCAL_DEVELOPMENT/DEPLOYMENT_RUNBOOK）；验收脚本 acceptance-v02-main-flow.py 13/13。验证：test:domain 51/51、eslint 0、build、.mjs 6/6、重排 32/32。
- [x] 匿名 owner 隔离（2026-08-20，demo anonymous workspace isolation，非鉴权）：`ownerOf()` 优先读 `x-trellis-owner-id` header（正则校验，无/非法回退 DEFAULT_OWNER）；前端 localStorage 生成 UUID + `apiFetch()` 统一注入 header；7 个新测试（ownerOf 3 + 多 owner 隔离 4）；验收脚本适配统一 owner。test:domain 49/49、HTTP 层端到端隔离验证通过、验收 32/32。

## 最近验证证据

本机（trellis-cleanup）复跑（2026-08-14 体验修复轮）：

- `npm run test`：6/6 通过，含 build 与 Sites artifact 校验。
- `npm run test:domain`：41/41 通过（相邻分支测试已随 ai-literacy 行为变更更新）。
- eslint（app + lib，排除 dist/.next）：0 problems。
- 浏览器 UI 验证（Playwright，真实 Chromium，8h 容量新用户）：16/16 通过——时间选项含 20h、周看板 18 个活动、抽屉 5 项交互、成长页中文/相邻分支/调整表单、工作台收集箱/资源/工具、AI 接入说明。
- `POST /api/learning/adjustments/propose` → proposed → confirm → accepted 全链路验证通过。

本机（trellis-cleanup）复跑（2026-08-20 重排本周轮）：

- `npm run test:domain`：42/42 通过，新增“重排本周保留证据和节点状态”测试。
- eslint（新增/改动 app + lib + test 文件）：0 problems。
- `.\node_modules\.bin\vinext.cmd build`：通过，路由表含 `/api/learning/replan`、`/api/learning/reset`、`/api/learning/api-config`。
- `node --test tests\*.test.mjs`：6/6 通过。
- `npm run test` 在当前 Windows/WSL 环境下因 bash 脚本进入 WSL 后找不到 `node` 失败；已用 Windows 原生命令完成等价验证（build + 6 个既有测试）。

本机（trellis-cleanup）浏览器验收（2026-08-20 重排验收轮，`scripts/acceptance-replan.py`，Playwright）：

- 32/32 通过：入口可见 → 重新设置回诊断 → 8h/全局认知诊断 → 首周计划（核心 3+可选 2，180/480 分钟）→ 抽屉 5 项交互 → 活动闭环评估通过 → 成长页 validated/中文/相邻分支/支持证据 → 重排本周 → 证据 1=1 保留、validated 节点保留、新活动 +8（5→9）、待替换 4 个全移除、状态未清空、无 JS 错误。
- 结论：可作为演示版本，无必须修复项。

部署前检查（2026-08-20）：

- 远程 `trellis-v02-d1`（uuid `5490481c-c5a9-4423-8906-6a0d0e6e278f`）num_tables=0，需应用 0004/0005/0006 迁移；部署 build 需 `DATABASE_ID=<uuid>`；wrangler OAuth 登录有效（rashaunzh@gmail.com）。

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

- 浏览器自动化验收已由本任务完成（Playwright 16/16 + 重排验收 32/32），证据见“最近验证证据”。
- 旧 D1 状态已有温和处理入口：学习页“重排本周”会保留证据和节点进度，并替换未产生证据的开放活动；“重新设置”才会清空学习状态并回到诊断。
- 公网匿名 owner 隔离已上线实现（header 隔离，非鉴权）：每个浏览器一个独立状态；换浏览器/清缓存丢状态、ownerId 可伪造是已知边界。真鉴权（登录体系）明确不做。
- **远程 D1 `trellis-v02-d1` 已应用迁移（2026-08-20）**：0004/0005/0006 已跑，15 张 learning_ 表就位；生产 build 用 `DATABASE_ID=5490481c-c5a9-4423-8906-6a0d0e6e278f` 生成。
- **公网部署已完成（2026-08-20）**：`https://trellis.rashaunzh.workers.dev` 已上线（version 93c2a2bd），/product /learn /grow /workbench /api/learning/workspace 全部 200；账号 workers.dev 子域已注册为 `rashaunzh`。远程库为空（全新用户起点）；验证线上 URL 的 curl 必须带浏览器 UA（Bot Fight Mode 403 坑）。
- Sites 保存/部署需要基于已推送 commit；`.openai/hosting.json` 已有 project_id（appgprj_6a72003abefc8191a4bd0c79702ee892）可复用，不新建 site。
- 本地 D1 数据只存在于当前机器 `.wrangler/state`；新机器首次打开交互页前如遇缺表，按 `docs/development/LOCAL_DEVELOPMENT.md` 的“本地 D1 初始化”执行迁移。
- P0：综合情境任务已落地为 integrated_task 活动类型（planner + composer + 抽屉），CP-B 已实质完成；掌握确认（pending_confirmation）、延迟复测（retest）仍是计划。
- AI 通识 V1 的完整来源目录、节点量规、可信度审计仍需补齐。
- 工作台资源映射已具备骨架，但外部材料自动同步和摘要卡片仍需深化。
- 旧 V0.1 实现仍保留为兼容层，未来需要明确清理或迁移策略。
- 生产部署、远程 D1 迁移、备份和环境变量管理另行确认（本轮只做了部署前检查，未执行部署）。

## 精确下一步

1. 提交推送工程可用 MVP 轮（内容包/planner/composer/抽屉/收集箱/旧接口删除/文档/脚本/memory），显式 `git add`，push 走 Clash 代理，同步双克隆。
2. 重新部署线上：远程 D1 应用 0007/0008 迁移 → `DATABASE_ID=<uuid> vinext build` → `wrangler deploy` → 线上验证（Bot Fight Mode 带 UA）。
3. 用户验收：本地 `http://localhost:3410/learn`（截图 `.wrangler/acceptance-shots-v02/`）或公网 URL；验收通过即工程可用 MVP。
4. 进入 P0 剩余：掌握确认（pending_confirmation）、延迟复测（retest），每 Checkpoint 停下让用户检查：
   - CP-A：数据模型与迁移；
   - CP-B：综合情境任务流；
   - CP-C：掌握确认（确认/纠正两分支）；
   - CP-D：延迟复测闭环 + 全量回归 + 双克隆同步。
