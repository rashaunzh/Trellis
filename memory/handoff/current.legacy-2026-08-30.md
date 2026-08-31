# 当前接力

更新时间�?026-08-24

## 当前目标

�?GitHub 仓库 `rashaunzh/AI-Learning-OS` 的默认分�?`main` 上推�?Trellis V0.2 MVP。当前阶段已经完�?Checkpoint 5、P0 三件套、产品交付物和可交互产品网页；`docs/trellis-v02-adaptive-learning-prd` 已与 `main` 指向同一最新提交，后续�?`main` 为唯一交付源�?

本轮浏览器自动化验收由另一条任务负责；当前接力不把浏览器验收写成已完成�?

## 已确认的产品与工程基�?

- 产品正式名称�?**Trellis**�?
- 核心价值是�?*可信的动态学习编�?*�?
- 前台一级功能固定为 **学习 / 成长 / 工作�?*，不再使用“继续学�?/ 学习路径 / 复习评估 / 资源库”四页面结构�?
- 学习地图和个人成长树是同一张图的两层表达，不拆成两个功能�?
- 默认按周推进，不做今日活动、每日排程、打卡或独立“继续学习”�?
- 节点主状态为 `unstarted` / `growing` / `validated`。活动完成不直接验证节点，证�?accepted 后才可能触发节点验证�?
- 允许跳学，但必须通过证据验证；暴露前置缺口时再插入补强活动�?
- 活动高动态，周计划半稳定，长期路径版本化；改变主路径或核心能力判断必须由用户确认�?
- MVP 不建设内嵌自�?agent runtime，只保留 planner、activityComposer、evidenceEvaluator、adjustmentAdvisor 四类可替换接口�?

## 交付�?

- GitHub 默认分支 `main` 是唯一交付源�?
- 本地 clone 只是工作区；不要把任何盘符路径写成长期唯一源�?
- 会话开始前拉取，结束后按需提交和推送；冲突时停止，不得覆盖另一台设备的工作�?

## 当前进度

- [x] Phase 0：文档与交接修复�?
- [x] Phase 1：领域模型与数据结构�?
- [x] Phase 2：后�?API �?workspace 读取模型�?
- [x] Phase 3：学�?/ 成长 / 工作台三功能前端�?
- [x] Phase 4：活动抽屉闭环、证据退�?修订/接受、节点证据驱动变色、调整建议确认�?
- [x] Phase 5：D1 持久化、重启恢复、全量测试与构建验证�?
- [x] 交付整理：新�?`docs/product/TRELLIS_V0.2_MVP_DELIVERY.md`，明确最终验收口径、MVP 交付说明、产品复盘和下一阶段计划�?
- [x] 产品介绍：新�?`docs/product/TRELLIS_PRODUCT_INTRODUCTION.md`，面向协作者、潜在用户和产品评审者�?
- [x] 可交互产品网页：新增 `/product`，包含价值主张、三功能结构、互动周计划演示、核心闭环切换、证据驱动节点变色演示，并可跳转 `/learn`、`/grow`、`/workbench`�?
- [x] 产品�?UI 调整：缩�?`/product` 首屏标题和品牌区，修复导�?logo 文本溢出�?
- [x] 自适应路线规划审计与规则版 helper�?026-08-24）：审计 RulePlanner/RuleActivityComposer 写死点；新增 `lib/learning/agents/adaptive-types.ts`（GoalAnalysis/CapabilityMap/AdaptivePlan 契约）、`lib/learning/agents/adaptive-planner.ts`（toCapabilityMap 投影 + RuleAdaptiveRoutePlanner + 五阶段信号化活动组合器）、`tests/learning-domain/adaptive-planner.test.ts` 14 用例；设计文�?`docs/engineering/TRELLIS_V0.2_ADAPTIVE_ROUTE_PLANNER.md`。验证：129/129 领域测试（原 115 + �?14）、tsc 0 错误、eslint 0。未接入服务层（planner 选择逻辑留待用户决策）�?
- [x] Full Chain Phase 1 + 2�?026-08-24）：类型统一（GoalAnalysis / CourseMaterialAnalysis / Capability / CapabilityMap / CapabilityEdge 单一契约�?`agents/types.ts`，`adaptive-types.ts` �?re-export）；新增 `goal-analyzer.ts` / `course-analyzer.ts` 规则实现；注�?goalAnalyzer / courseAnalyzer / adaptiveRoutePlanner；服务层接线（runDiagnostic �?goalAnalyzer �?courseAnalyzer �?capabilityMapper �?adaptiveRoutePlanner �?`workspace.analysis` transient 预览）。默认链路仍�?legacy planner，confirmProposal / replanCurrentWeek 不读�?adaptivePlan；generic 能力不进入证据评审闭环。验证：151/151 领域测试（原 129 + �?22）、tsc 0 错误、eslint 0�?
- [x] Full Chain Phase 3�?026-08-24）：受控 adaptive 激活。新�?plannerMode（`legacy` 默认 / `adaptive_preview` / `adaptive_existing_content`），�?`learning_diagnostics` 遗留表快照持久化（无 schema 变更）；confirmProposal 仅当快照请求 adaptive_existing_content 且重建分析命�?existing_content 时用 adaptivePlan 驱动（新 `adapters.ts` �?adaptiveDraftToActivity 落库），否则回退 legacy 并标记。generic 永不进入正式闭环；默认流程行为不变。验证：159/159 领域测试（原 151 + �?8）、tsc 0 错误、eslint 0�?
- [x] 本地交互页修复：对当�?Miniflare D1 应用 `drizzle/0004` �?`drizzle/0005`，解�?`/learn` �?`D1_ERROR: no such table: learning_routes`；开发文档已补本�?D1 初始化命令�?
- [x] 产品体验修复（本轮）：每周时间上�?6h�?0h；规划器一个节点拆多个活动（按容量，上�?8 核心）；学习页周看板 + 容量统计 + 活动抽屉交互（步骤勾�?笔记/自检/证据类型/外部链接）；成长页中文节点名、相邻分支、主动调整表单；新增 `POST /api/learning/adjustments/propose`；工作台收集�?+ 资源加入 + 工具本周使用 + AI 接入说明�?
- [x] 旧状态体验补洞（2026-08-20）：新增温和重排本周 `POST /api/learning/replan` 与学习页“重排本周”按钮；保留已产生证据、已完成活动和节点进度，只替换本周未产生证据的开放活动；“重新设置”继续作为硬清空入口�?
- [x] AI 接入从说明推进到最小配置：工作台支�?OpenAI 兼容 `base_url`、API Key、model 与启用开关；API Key 只保存在服务端配置表，前端仅显示脱敏状态；未配置时回退规则版评估�?
- [x] 重排本周浏览器验收（2026-08-20）：新增 `scripts/acceptance-replan.py`�?2/32 通过；证�?节点/支持证据列表保留、未产生证据活动被替换、新活动出现、状态未清空，可作为演示版本�?
- [x] P0 掌握确认/延迟复测轮验证（2026-08-20）：

- `npm run test:domain`�?9/59�?8：掌握确�?4 + 复测 4，含普通活动自动验证回归）�?
- eslint 0；build 通过（路由含 nodes/:id/confirm-mastery、nodes/:id/retest）；.mjs 6/6�?
- 浏览�?P0：综合任务→待确�?�?→确认掌握→validated + mastery_confirm 记录；复测提醒卡→生成复测活动�?
- 回归：acceptance-v02-main-flow.py 13/13、acceptance-replan.py 32/32�?

工程可用 MVP 轮验证（2026-08-20）：

- `npm run test:domain`�?1/51�?2 内容包字段完整�?缺失抛错）�?
- eslint 0 problems；`vinext build` 通过（路由含 resources/inbox，旧路由 progress/content 已移除）；`node --test tests\*.test.mjs` 6/6（rendered-html 改验 build 产物路由）�?
- `scripts/acceptance-v02-main-flow.py`�?3/13（新用户�?h 计划 core6/total8→抽�?6 段→短证据退回→修订通过→节�?validated→重排证�?2=2 保留→多 owner 隔离→reset 只清当前）�?
- 收集箱端到端：无 profile 可读写、刷新持久化、多 owner 隔离�?
- `scripts/acceptance-replan.py`�?2/32 回归通过�?

部署前检查（2026-08-20）：`.openai/hosting.json` �?project_id 可复用；远程 D1 `trellis-v02-d1` 已建但迁移从未应用（num_tables=0）；`dist/server/wrangler.json` �?placeholder 需 `DATABASE_ID` 重新 build；无敏感信息入库�?
- [x] P0 工程任务计划�?026-08-20）：产出 `docs/engineering/TRELLIS_V0.2_P0_PLAN.md`——综合情境任务（复用 activity + synthesis_task subtype）、掌握确认（pending_confirmation + 复用 adjustments）、延迟复测（复测元数据列 + retest 活动），含数据模�?API/前端/测试/实施顺序/Checkpoint�?
- [x] P0 三件套全部落地（2026-08-20）：综合情境任务（MVP �?integrated_task�? 掌握确认（pending_confirmation 四色 + confirm-mastery API + 纠正降级补强�? 延迟复测（retest 活动 + dueReviews 提醒 + 通过顺延/失败降级）�?
- [x] 工程可用 MVP�?026-08-20，Phase A–G 收尾）：内容样本接入（AI-For-Beginners�? 中文节点 + sourceRefs 可点�?+ 量规 + 模板）；planner 6 类活动（45/45/90/30/30/120 拆单�?h→核�?360/360）；抽屉 6 段（为什么学/学什�?步骤/输出/自检/提交）；工作台收集箱持久化（learning_user_resources + /api/learning/resources/inbox，独立于学习状态）；删�?V0.1 旧接口（progress/proposal/content）；.gitignore�? 份工程文档（API_CONTRACT/STATE_MACHINE/LOCAL_DEVELOPMENT/DEPLOYMENT_RUNBOOK）；验收脚本 acceptance-v02-main-flow.py 13/13。验证：test:domain 51/51、eslint 0、build�?mjs 6/6、重�?32/32�?
- [x] 匿名 owner 隔离�?026-08-20，demo anonymous workspace isolation，非鉴权）：`ownerOf()` 优先�?`x-trellis-owner-id` header（正则校验，�?非法回退 DEFAULT_OWNER）；前端 localStorage 生成 UUID + `apiFetch()` 统一注入 header�? 个新测试（ownerOf 3 + �?owner 隔离 4）；验收脚本适配统一 owner。test:domain 49/49、HTTP 层端到端隔离验证通过、验�?32/32�?

## 最近验证证�?

本机（trellis-cleanup）复跑（2026-08-14 体验修复轮）�?

- `npm run test`�?/6 通过，含 build �?Sites artifact 校验�?
- `npm run test:domain`�?1/41 通过（相邻分支测试已�?ai-literacy 行为变更更新）�?
- eslint（app + lib，排�?dist/.next）：0 problems�?
- 浏览�?UI 验证（Playwright，真�?Chromium�?h 容量新用户）�?6/16 通过——时间选项�?20h、周看板 18 个活动、抽�?5 项交互、成长页中文/相邻分支/调整表单、工作台收集�?资源/工具、AI 接入说明�?
- `POST /api/learning/adjustments/propose` �?proposed �?confirm �?accepted 全链路验证通过�?

本机（trellis-cleanup）复跑（2026-08-20 重排本周轮）�?

- `npm run test:domain`�?2/42 通过，新增“重排本周保留证据和节点状态”测试�?
- eslint（新�?改动 app + lib + test 文件）：0 problems�?
- `.\node_modules\.bin\vinext.cmd build`：通过，路由表�?`/api/learning/replan`、`/api/learning/reset`、`/api/learning/api-config`�?
- `node --test tests\*.test.mjs`�?/6 通过�?
- `npm run test` 在当�?Windows/WSL 环境下因 bash 脚本进入 WSL 后找不到 `node` 失败；已�?Windows 原生命令完成等价验证（build + 6 个既有测试）�?

本机（trellis-cleanup）浏览器验收�?026-08-20 重排验收轮，`scripts/acceptance-replan.py`，Playwright）：

- 32/32 通过：入口可�?�?重新设置回诊�?�?8h/全局认知诊断 �?首周计划（核�?3+可�?2�?80/480 分钟）→ 抽屉 5 项交�?�?活动闭环评估通过 �?成长�?validated/中文/相邻分支/支持证据 �?重排本周 �?证据 1=1 保留、validated 节点保留、新活动 +8�?�?）、待替换 4 个全移除、状态未清空、无 JS 错误�?
- 结论：可作为演示版本，无必须修复项�?

部署前检查（2026-08-20）：

- 远程 `trellis-v02-d1`（uuid `5490481c-c5a9-4423-8906-6a0d0e6e278f`）num_tables=0，需应用 0004/0005/0006 迁移；部�?build 需 `DATABASE_ID=<uuid>`；wrangler OAuth 登录有效（rashaunzh@gmail.com）�?

更早的验证（交付整理轮，用户 2026-08-14 提供）：

- `npm run test`�?/6、`npm run test:domain`�?1/41、`npm run lint`�? problems、`git status`：干净，HEAD `2285092`�?
- `/product`、`/learn` 返回 200；`/api/learning/workspace` 返回 200，不再报缺表；产品页 TSX eslint 通过，`vinext build` 通过�?

## 重要文档入口

- `docs/product/TRELLIS_V0.2_PRD.md`：当前产品基线�?
- `docs/product/TRELLIS_PRODUCT_INTRODUCTION.md`：产品介绍�?
- `docs/product/TRELLIS_V0.2_MVP_DELIVERY.md`：Checkpoint 5 后的交付、验收、复盘和下一阶段计划�?
- `/product`：可交互产品介绍网页�?
- `docs/architecture/TRELLIS_V0.2_ARCHITECTURE.md`：学习编排内核架构�?
- `docs/engineering/TRELLIS_V0.2_IMPLEMENTATION_PLAN.md`：Phase 0�? 实施计划�?
- `memory/decisions/2026-08-12-v0.2-adaptive-learning.md`：V0.2 自适应学习方向�?
- `memory/decisions/2026-08-13-v0.2-mvp-scope.md`：MVP 不止于路径确认的范围决策�?

## 尚未完成 / 开放问�?

- 浏览器自动化验收已由本任务完成（Playwright 16/16 + 重排验收 32/32），证据见“最近验证证据”�?
- �?D1 状态已有温和处理入口：学习页“重排本周”会保留证据和节点进度，并替换未产生证据的开放活动；“重新设置”才会清空学习状态并回到诊断�?
- 公网匿名 owner 隔离已上线实现（header 隔离，非鉴权）：每个浏览器一个独立状态；换浏览器/清缓存丢状态、ownerId 可伪造是已知边界。真鉴权（登录体系）明确不做�?
- **远程 D1 `trellis-v02-d1` 已应用迁移（2026-08-20�?*�?004/0005/0006 已跑�?5 �?learning_ 表就位；生产 build �?`DATABASE_ID=5490481c-c5a9-4423-8906-6a0d0e6e278f` 生成�?
- **公网部署已完成（2026-08-20�?*：`https://trellis.rashaunzh.workers.dev` 已上线（version 93c2a2bd），/product /learn /grow /workbench /api/learning/workspace 全部 200；账�?workers.dev 子域已注册为 `rashaunzh`。远程库为空（全新用户起点）；验证线�?URL �?curl 必须带浏览器 UA（Bot Fight Mode 403 坑）�?
- Sites 保存/部署需要基于已推�?commit；`.openai/hosting.json` 已有 project_id（appgprj_6a72003abefc8191a4bd0c79702ee892）可复用，不新建 site�?
- 本地 D1 数据只存在于当前机器 `.wrangler/state`；新机器首次打开交互页前如遇缺表，按 `docs/development/LOCAL_DEVELOPMENT.md` 的“本�?D1 初始化”执行迁移�?
- P0 三件套已全部实现（综合任�?掌握确认/延迟复测）。下一价值方向：内容包深化（AI-For-Beginners 全量映射）、AI 评估接入（工作台 API 配置已就绪）、自定义域名（演示对象在国内时）�?
- AI 通识 V1 的完整来源目录、节点量规、可信度审计仍需补齐�?
- 工作台资源映射已具备骨架，但外部材料自动同步和摘要卡片仍需深化�?
- �?V0.1 实现仍保留为兼容层，未来需要明确清理或迁移策略�?
- 生产部署、远�?D1 迁移、备份和环境变量管理另行确认（本轮只做了部署前检查，未执行部署）�?
- Full Chain Phase 3�?026-08-24，已完成，见"当前进度"）：受控 adaptive 激活上线（plannerMode 三态，legacy 默认）�?*仍未切换默认 planner**；materialIds / preference / plannerMode 已随诊断快照�?learning_diagnostics（无 schema 变更），analysis 仍只�?runDiagnostic 响应上附带�?
- 并发任务重叠提示�?026-08-24，已解决）：capability-mapper.ts �?adaptive-types.ts 的同�?`CapabilityMap` 结构冲突已在 Phase 1 统一为单一契约（types.ts + adaptive-types re-export），不再有两套冲突类型�?

## 精确下一�?

1. 提交推�?P0 轮（state-machine/types/schema 0009/d1/service/composer/2 API/前端四色+复测�?测试/memory），显式 `git add`，push �?Clash 代理，同步双克隆�?
2. 重新部署线上：远�?D1 应用 0009 迁移 �?`DATABASE_ID=<uuid> vinext build` �?`wrangler deploy` �?线上验证（Bot Fight Mode �?UA）�?
3. 用户验收：本�?`http://localhost:3411/learn`（截�?`.wrangler/acceptance-shots-p0/`）或公网 URL；验收掌握确认与复测提醒�?
4. 下一方向（待用户选）：内容包深化 / AI 评估接入 / 自定义域名�?
   - CP-A：数据模型与迁移�?
   - CP-B：综合情境任务流�?
   - CP-C：掌握确认（确认/纠正两分支）�?
   - CP-D：延迟复测闭�?+ 全量回归 + 双克隆同步�?
5. Full Chain 后续（Phase 4+，待用户决策）：默认 planner 是否切换（需先处�?adaptive 链缺 quiz/reflection、satisfied 语义差异、generic 能力证据闭环�?FK 约束）；信号化组合器替换/并存策略；D1 生产库验�?learning_diagnostics 快照读写�?
## 2026-08-24��Ponytail ���ɵ� DSH������������Ӱ���Ʒ��

- ���� github.com/DietrichGebert/ponytail��10.9 �� star �ġ����������ʦ�����������
- �û�ȷ�ϼ��ɽ� DeepSeek Harness�����������ļ���DSH ����ʵʱ��Ч��
  1. AGENTS.local.md���ֿ������ponytail ���ĳ�פ������Ӳ㣬����Ŀÿ�λỰ�Զ����ء�
  2. ~/.agents/skills/ponytail/SKILL.md��ȫ�ּ��ܣ�����/�ع�/review/bugfix ��������ء�
- �������ų���MCP ��ʽ��DSH ֻ�� tools ���� prompts���޷�ÿ��ע�룩��

## 2026-08-26：作品级 Agentic Learning Companion 第一切片

- 用户确认 Trellis 目标要达到作品级工程完整度，参考 EchoMind 但不照搬客服多 Agent；Trellis 原创主线固定为 Learning Situation-first dynamic learning adaptation。
- 已安装 `@mastra/core` 并接入真实 Mastra workflow 对象 `trellisLearningSituationWorkflow`，核心步骤为 assessSituation / auditMaterials / mapCapabilities / planStagePath / simulateDynamicAdjustment。
- `LearningSituation` 已扩展容量、精力、行为、证据质量和 nextBestMove。
- `runDiagnostic().analysis` 已返回 `stagePath`（8 周 AI PM 转型启动阶段路径）与 `dynamicSimulation`（前三周动态调整演示）。
- 新增 `/api/learning/quality` 与 `/api/learning/eval`，用于作品级 monitor/eval 读模型。
- 新增产品文档 `docs/product/TRELLIS_PORTFOLIO_AGENTIC_LEARNING_COMPANION.md` 与 session `memory/sessions/2026-08-26-portfolio-agentic-learning-companion.md`。
- 验证：`npx tsc --noEmit --incremental false` 通过；`node --test --test-isolation=none "tests/learning-domain/*.test.ts"` 182/182 通过。
- 下一步：跑 eslint；把前端 `/learn` 展示升级为作品级读模型；补 Mastra Studio 运行指南；把 artifact loop 从 transient analysis 推进到正式活动链。## 2026-08-26：作品级 Demo Surface

- `/learn` 入口已改成 Learning Situation-first，诊断前说明 Trellis 会先判断目标、资料、能力、时间容量、精力、行为风险和证据质量。
- 诊断提案页已展示学习处境详情、active risks、nextBestMove、完整 8 周 StagePath、前三周 DynamicSprintSimulation 和 trace。
- 已确认学习页新增作品级质量面板，接入 `/api/learning/quality` 与 `/api/learning/eval`，可展示 monitor 指标和 eval pass 结果。
- `lib/learning/frontend.ts` 新增 `fetchLearningQuality()` 与 `runPortfolioEval()`。
- 验证：`npx tsc --noEmit --incremental false` 通过；`node --test --test-isolation=none "tests/learning-domain/*.test.ts"` 182/182 通过；`npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过。
- 本地 dev server 已在 `http://127.0.0.1:5174/` 启动；`/learn` HTTP 200。API 验证：diagnostic 返回 8 周路径 + 4 次动态调整；eval 返回 5/5 通过、avgScore 0.88；quality 返回 fallback 与资料错配指标。
- 浏览器 MCP 未连接，Chrome DevTools 未开 debug 端口，因此本轮未完成截图级视觉验收。
- 下一步：补 Mastra Studio 运行指南和可截图 workflow；把 artifact loop 从 transient analysis 推进到正式活动链；准备 10-15 分钟 demo script。

## 2026-08-27：Mastra Workflow 可运行化与作品级演示闭环

- 确认当前仓库安装的是 `@mastra/core@1.62.0`，没有本地 Mastra CLI / Studio bin；本轮不宣称 Studio 已完成。
- `trellisLearningSituationWorkflow` 已可通过真实 Mastra runtime 运行：新增 `runTrellisMastraWorkflowDemo()` 与固定 demo input。
- 新增 `npm run demo:mastra`，输出 workflowTrace、HITL steps、8 周 stagePath、4 次 dynamic adjustments 和 `fallbackMode=rule`。
- 新增工程 runbook `docs/engineering/TRELLIS_MASTRA_WORKFLOW_RUNBOOK.md`。
- 新增作品集演示脚本 `docs/product/TRELLIS_PORTFOLIO_DEMO_SCRIPT.md`。
- 更新 `docs/product/TRELLIS_PORTFOLIO_AGENTIC_LEARNING_COMPANION.md`，明确 UI demo surface 已完成、workflow demo 可运行、Studio 与 artifact loop 仍是边界。
- 新增领域测试：Mastra workflow demo 可运行并输出固定 trace。
- 验证：`npm run demo:mastra` 通过；领域测试 183/183 通过；`npx tsc --noEmit --incremental false` 通过；`npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过；`/learn` HTTP 200；eval 5/5、avgScore 0.88。
- 下一步建议：Artifact Loop 正式活动链，让 StagePath 的 Week 3/5 作品目标生成 integrated_task，作品 evidence 进入评审、掌握确认和 quality monitor。

## 2026-08-27：Artifact Loop 正式活动链

- 已将作品产出从 transient analysis / demo 表达推进到正式活动链：新增 `LearningApplicationService.createPortfolioArtifactActivity(ownerId)`。
- 新增 `/api/learning/artifact`，用于显式生成 AI Agent 产品 PRD v1 作品任务。
- `/learn` 已确认页新增“阶段作品闭环”：可生成作品任务、查看作品活动状态、证据状态，并提示“通过后需掌握确认”。
- 作品任务复用现有 `integrated_task -> submitEvidence -> reviewEvidence -> pending_confirmation -> confirmMastery` 闭环；hard evidence 才推动状态，且不自动把作品通过等同于掌握。
- 新增 session：`memory/sessions/2026-08-27-artifact-loop-activity-chain.md`。
- 更新文档：`docs/product/TRELLIS_PORTFOLIO_AGENTIC_LEARNING_COMPANION.md`、`docs/engineering/TRELLIS_MASTRA_WORKFLOW_RUNBOOK.md`。
- 验证：`npx tsc --noEmit --incremental false` 通过；`node --test --test-isolation=none "tests/learning-domain/*.test.ts"` 184/184 通过；`npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过；本地 `/learn` 与 `/api/learning/quality` 均 HTTP 200。
- 准确下一步：做 Artifact Review -> Next Stage Adjustment，让作品评审结果生成下一阶段路线/补强建议；并把作品任务与 StagePath Week 3/5 里程碑建立可追溯引用。

## 2026-08-27：Artifact Review 到下一阶段建议

- 作品闭环继续推进：`confirmMastery(confirmed)` 后会识别正式作品任务；若该作品已有 accepted evidence，则生成 `route_revision proposed` 下一阶段建议。
- 下一阶段建议固定为 AI PM 作品集下一阶段：作品包装、评测深化、10-15 分钟项目讲述；仍需用户采纳，不自动改路线。
- `confirmMastery(corrected)` 不生成下一阶段建议，仍走原有 weekly_light 补强建议。
- 作品任务文案已绑定 StagePath Week 3/5：Week 3 确认作品方向，Week 5 提交作品 v1。
- `/learn` 阶段作品闭环区展示 Week 3/Week 5 chip、作品证据状态和下一阶段建议摘要；调整记录对作品下一阶段 route_revision 显示具体行动说明。
- 新增 session：`memory/sessions/2026-08-27-artifact-next-stage-adjustment.md`。
- 更新文档：`docs/product/TRELLIS_PORTFOLIO_AGENTIC_LEARNING_COMPANION.md`、`docs/engineering/TRELLIS_MASTRA_WORKFLOW_RUNBOOK.md`。
- 验证：`npx tsc --noEmit --incremental false` 通过；`node --test --test-isolation=none "tests/learning-domain/*.test.ts"` 185/185 通过；`npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过；本地 `/learn` 与 `/api/learning/quality` 均 HTTP 200。
- 准确下一步：做 proposed `route_revision` 采纳后的产品化效果（下一阶段计划视图或行动生成），以及浏览器截图级验收。

## 2026-08-27：Core Architecture 五阶段主梁实现

- 用户要求实现五个阶段的作品级架构计划，不再只做一个薄切片；目标是让 Trellis 的技术厚度更接近 EchoMind / Elis 级可展示项目，同时保持原创主线 Learning Situation-first dynamic learning adaptation。
- 新增 `TrellisCoreKernel`，聚合现有规则引擎和内部 tools，输出结构化 `KernelDecision`，但不直接写持久状态。
- 新增 Decision Trace：记录 trigger、inputs、signals、workflow steps、HITL 和 stateChanges。
- 新增 Learning Memory Snapshot：聚合 hard evidence、soft signal、behavior、material、artifact、decision memory，并通过 `/api/learning/memory` 暴露。
- 新增内部 Trellis Tool Registry，标准化 10 个核心 tools，供 Kernel / Mastra workflow 调用。
- Mastra workflow demo 扩展为 10 步，覆盖从学习处境到资料、能力、阶段路径、动态调整、作品任务、证据评审、掌握确认、下一阶段建议和质量汇总。
- `/learn` 质量面板已展示 memory、trace completeness、tool registry 和 workflow readiness。
- 新增架构文档：`docs/architecture/TRELLIS_CORE_ARCHITECTURE.md`、`docs/architecture/TRELLIS_DECISION_TRACE.md`、`docs/architecture/TRELLIS_LEARNING_MEMORY_MODEL.md`、`docs/engineering/TRELLIS_TOOL_LAYER.md`。
- 验证：`npx tsc --noEmit --incremental false` 通过；领域测试 190/190 通过；`npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过；`npm run demo:mastra` 通过；本地 `/learn`、quality、memory 200；eval 使用 POST 200，10/10。
- 当前边界：内部 tools 尚不是 MCP server；Learning Memory 不是向量记忆；Mastra 仍是 workflow runtime demo，未宣称 Studio 完成；route_revision 采纳后的下一阶段计划产品化仍是下一步。
- 准确下一步：把 `route_revision proposed` 的采纳结果产品化为下一阶段行动视图或 StagePath；做浏览器截图级验收；再评估是否接入 Mastra Studio / MCP / 生产 observability。

## 2026-08-27：Next Stage Adoption Runtime

- 已实现作品级 `route_revision` 采纳后的下一阶段行动视图：采纳“作品已通过掌握确认”的 route_revision 后，workspace 会聚合出 `nextStagePlan`。
- 新增 `lib/learning/agents/next-stage-planner.ts`，定义 `NextStagePlan`、作品级下一阶段 adjustment 识别和读模型生成。
- `NextStagePlan` 固定为 AI PM 作品集包装阶段，包含作品包装、评测深化、项目讲述三个模块；继承原作品 accepted hard evidence 与 mastery confirmation，不清空历史证据。
- `/learn` 阶段作品闭环区会在采纳后展示 Next Stage 面板；质量面板新增 `nextStagePlanExists`。
- 普通手动 `route_revision` 不生成 NextStagePlan，保留原空动作行为。
- 更新文档：作品级目标文档、Mastra runbook、核心架构文档。
- 验证：`npx tsc --noEmit --incremental false` 通过；领域测试 190/190 通过；`npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过；`npm run demo:mastra` 通过；本地 `/learn`、quality、memory 200；eval POST 200，10/10。
- 当前边界：NextStagePlan 是聚合读模型，不新增 DB 表；尚未把三个模块转成正式活动；未接 Mastra Studio / MCP。
- 准确下一步：做浏览器截图级验收；或把 NextStagePlan 三个模块转成正式活动；或接 Mastra Studio/workflow trace UI 做工程展示。

## 2026-08-27：Mastra Runtime API 与 UI 展示

- 已将 Mastra 从命令行 demo 推进为 runtime/API/UI 可运行层：新增 `trellisMastraRuntime = new Mastra({ workflows })`，并让 `runTrellisMastraWorkflowDemo()` 通过 runtime 注册的 workflow 执行。
- 新增 `/api/learning/mastra-runtime`：GET 返回 runtime 注册状态、10 个 steps、5 个 HITL 和 Studio 边界；POST 运行固定作品级 workflow demo。
- `/learn` 作品级质量面板新增“运行 Mastra runtime”按钮，展示 runId、traceId、10-step workflowTrace、HITL、fallback 和 StagePath 信息。
- 修正 `trellisMastraWorkflowSpec` 中 `simulateDynamicAdjustment` 的 HITL 口径，与实际 trace 一致。
- 更新 `docs/engineering/TRELLIS_MASTRA_WORKFLOW_RUNBOOK.md` 与 `docs/product/TRELLIS_PORTFOLIO_AGENTIC_LEARNING_COMPANION.md`，明确当前完成 runtime/API/UI，不宣称 Studio 完成。
- 验证：`npx tsc --noEmit --incremental false` 通过；领域测试 190/190 通过；focused tests 14/14 通过；`npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过；GET runtime 200，hitlCount=5，stepCount=10；POST runtime 200，status=success，steps=10，hitl=5，fallback=rule。
- 当前边界：没有 Mastra CLI / Studio bin；runtime demo 使用固定作品级 payload，不写正式学习状态；正式状态仍由 Trellis service / D1 控制。
- 准确下一步：浏览器截图级验收；或安装/接入 Mastra CLI/Studio server 获取 workflow graph 截图；或把 NextStagePlan 三个模块转成正式活动。

## 2026-08-27：Mastra CLI / Studio 入口接入

- 已新增 `src/mastra/index.ts`，按 Mastra 官方约定导出 `mastra`，复用现有 `trellisMastraRuntime`，不新建第二套 workflow registry。
- `package.json` 新增脚本：`mastra:dev` = `npx mastra dev --dir src/mastra`；`mastra:studio` = `npx mastra studio --server-port 4111`。
- `portfolio-orchestration.test.ts` 增加断言，确认 Studio 入口导出的 `mastra` 可取到 `trellis-learning-situation-workflow`。
- 已更新 Mastra runbook 和作品级目标文档：当前口径是 CLI/Studio 入口已接入，runtime/API/UI 可运行；但 Studio 尚未启动截图验收。
- CLI 情况：查到 npm `mastra` 版本 1.27.0；尝试安装/临时 npx 下载均长时间无输出并中止。随后用 `npm install --ignore-scripts --no-audit --no-fund` 修复 node_modules 缺包；不把 CLI 固化进 devDependency，脚本用 npx。
- 验证：`npx tsc --noEmit --incremental false` 通过；领域测试 190/190 通过；focused tests 14/14 通过；`npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过；GET runtime 200，steps=10，HITL=5；POST runtime 200，status=success，steps=10。
- 当前边界：尚未成功运行 `mastra dev`，没有 Studio graph 截图；正式状态仍由 Trellis service / D1 控制。
- 准确下一步：网络稳定时运行 `npm run mastra:dev`，打开 `http://localhost:4111` 验证 Studio；截图 workflow graph / step output / HITL；随后回产品闭环，把 NextStagePlan 三个模块转成正式活动。

## 2026-08-27：NextStagePlan 正式活动化
- 采纳作品级 `route_revision` 后，`confirmAdjustment()` 会调用 `createNextStageActivities()`，把 `NextStagePlan` 三个模块生成正式学习活动。
- 生成活动：`下一阶段：作品包装`、`下一阶段：评测深化`、`下一阶段：项目讲述`；均挂当前周计划、isCore=true、复用现有 Evidence Review 闭环，并继承原作品 evidence / mastery confirmation 语义。
- `/learn` Next Stage 面板会显示“已生成 3 个正式活动 / 进入本周看板”。
- 普通手动 `route_revision` 不受影响，不生成下一阶段活动。
- 更新文档：作品级目标文档与 Mastra runbook。
- 验证：`npx tsc --noEmit --incremental false` 通过；focused tests 33/33 通过；领域测试 190/190 通过；`npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过；runtime API steps=10，HITL=5。
- 当前边界：下一阶段活动生成在当前周计划中，不新增阶段版本表；尚未做多轮作品版本管理或专用 rubric。
- 准确下一步：浏览器截图级验收；或为三个下一阶段活动补专用 evidence rubric；或启动 Mastra Studio 截图 workflow graph。

## 2026-08-27：Next Stage Rubric 与浏览器验收
- `NextStagePlan.modules` 新增 `rubric` 字段；作品包装、评测深化、项目讲述三个模块都有作品级评审标准。
- `createNextStageActivities()` 会把 rubric 写入正式活动的 `steps`、`expectedEvidence` 和 `evaluationCriteria`，让下一阶段活动不是只展示，而是进入可执行、可评审闭环。
- `/learn` Next Stage 卡片展示 rubric；本周看板中的三条下一阶段活动继承同一套标准。
- 新增无依赖浏览器验收脚本 `scripts/acceptance-next-stage-rubric.mjs`，并在 `package.json` 暴露为 `npm run acceptance:next-stage`。
- 浏览器验收会准备固定 demo 状态，打开 `/learn`，检查 Next Stage、3 个正式活动、Learning Situation-first / runtime fallback / 10-15 分钟 rubric、framework overlay 和浏览器异常，并保存截图 `docs/learn-next-stage-rubric.png`。
- 更新文档：`docs/product/TRELLIS_PORTFOLIO_AGENTIC_LEARNING_COMPANION.md`、`docs/engineering/TRELLIS_MASTRA_WORKFLOW_RUNBOOK.md`。
- 验证：`npx tsc --noEmit --incremental false` 通过；领域测试 190/190 通过；`npx eslint . --ignore-pattern dist --ignore-pattern .next` 通过；`npm run acceptance:next-stage` 通过；截图人工检查无明显重叠。
- 当前边界：rubric 已进入活动字段和 UI，但规则 evaluator 仍未做下一阶段作品专用维度评分；下一阶段活动仍挂当前周计划，不新增阶段版本表。
- 准确下一步：若继续产品闭环，做 rubric-aware Evidence Review；若继续工程展示，做 Mastra Studio / workflow trace 截图；若继续作品交付，整理 README、技术亮点和 demo script。

## 2026-08-29：日用可用学习闭环

- 用户选择“自己日用可用”作为功能完善标准，本轮从作品级展示转向连续几周真实使用。
- Workspace 新增 `weekReview` 聚合读模型，汇总完成活动、accepted evidence、待修订证据、开放活动、材料错配、容量、completionRate 和 nextBestMove。
- 新增 `/api/learning/week-review`：GET 返回当前周复盘；POST 基于当前周复盘生成下一周计划，并写入 `weekly_light accepted` 调整记录。
- `/learn` 新增“本次最小推进”区块：优先显示待评估证据、进行中活动、下一个核心活动，降低打开页面后的启动成本。
- `/learn` 新增“周复盘”区块：展示本周摘要、下一步建议，并在有完成/评审记录后允许生成下周计划。
- `/workbench` 支持手动材料选择映射节点；系统推荐资源/工具加入收集箱时保留 `relatedNodeIds`。
- 映射到当前节点的用户资源会自动追加到本周同节点活动 `inputRefs`，并更新活动 `nextAdvice`，让资源从收藏进入当前学习阶段。
- 验证：`npx tsc --noEmit --incremental false` 通过；领域测试 193/193 通过；eslint 通过；`npx vinext build` 通过；`node --test tests\*.test.mjs` 6/6 通过；`npm run acceptance:next-stage` 通过。
- 当前边界：`generateNextWeekPlan()` 已持久化下一周计划，但 `getWorkspace()` 仍默认读取当前周；下一轮需要周切换器或计划历史视图。周复盘暂为读模型，不新增 DB 表，不是长期归档周报。
- 准确下一步：做周切换器/计划历史，让已生成下周计划可查看和执行；随后把周复盘升级为可归档记录，并继续强化 activity-type-specific rubric review。

## 2026-08-29 日用 2.0 三周闭环更新

- 已按“日用 2.0：5-6 轮功能完善计划”完成第一批可运行闭环：`workspace?weekKey=YYYY-Www`、`weeklyPlanHistory`、`learning_week_reviews` 归档存储、`/api/learning/week-review` 指定周 GET/POST、`/learn` 周历史切换、周复盘归档/生成下周、用户资源进入当前和后续同节点活动。
- 新增迁移 `drizzle/0012_week_reviews.sql`，并同步 `db/schema.ts`、D1/InMemory store 和本地开发文档。本地 Miniflare D1 已应用 0012；远程 D1 部署前仍需应用。
- 新增 `npm run acceptance:three-week-loop`，已通过：诊断、首周计划、用户材料映射、短证据退回、修订 accepted、周复盘归档、第 2/3 周生成、周切换读取、刷新渲染、无框架错误 overlay。截图：`docs/acceptance-three-week-learn.png`、`docs/acceptance-three-week-review-history.png`、`docs/acceptance-three-week-artifact-loop.png`。
- 验证通过：`npx tsc --noEmit --incremental false`、`npm run lint`、`npm run build`、`node --test --test-isolation=none "tests/learning-domain/*.test.ts"`（196/196）、`node --test tests/*.test.mjs`（6/6）。
- 参考判断：`mattpocock/skills` 可借鉴为 Trellis 后续学习/复盘/证据评审 skill 包；`tt-a1i/archify` 适合工程架构、工作流、数据流图，产品功能架构仍建议 draw.io。
- 当前开放问题：跨周 action API 写入正确，但 start/evidence/review 返回 workspace 仍可能默认当前自然周；后续应统一返回活动所属周 workspace。`nextWeekKey` 仍是简化周键逻辑，后续可靠性轮次可改完整 ISO 周。`learningActivities.activityType` schema enum 已落后实际类型，SQLite 不强制但应整理。
- 下一步：先修跨周 action API 响应，再做 Evidence Review 按活动类型的修订体验细化，随后画功能架构/技术架构图。

## 2026-08-29 内容判断与行动卡重设计

- 用户确认 Trellis 当前 MVP 的特别定位应从“课程推荐/作业证明/作品包装”回到“学习内容整合、拆解和判断”：先判断课程或材料是否专业、是否适合现在，再切出本周最值得推进的几步。
- 已新增 workspace 读模型：`contentJudgment`、`weeklyActionPlan`、`nextAction`、`conceptHints`、`learningOutputs`。这些都由现有内容包、材料评审、活动、证据和用户资源推导，不新增 schema。
- `/learn` 首屏已改为“本次最小推进 → 本周最值得推进的几步 → 本周材料取舍 → 学习产出”；作品闭环和系统状态保留在下方，不再作为默认学习目的。
- 启动页方向改为 AI PM 入门、AI 评测与风险、AI 应用理解；阶段成果变为可选输出，时间选项改成粗颗粒度。
- 活动抽屉新增行动卡摘要、点击才解释的概念、四选一轻量情景判断；情景判断提交为 `judgment` evidence，仍走正式 Evidence Review。
- 材料判断读模型已对同名同内容用户资源去重，避免重复材料污染页面。
- 更新 `docs/product/TRELLIS_DAILY_USABLE_2_0.md` 与 session `memory/sessions/2026-08-29-content-judgment-action-plan.md`。
- 验证通过：`npx tsc --noEmit --incremental false`、`npm run lint`、`npm run build`、`node --test --test-isolation=none "tests/learning-domain/*.test.ts"`（197/197）、`node --test tests/*.test.mjs`（6/6）、`npm run acceptance:three-week-loop`。截图已更新：`docs/acceptance-three-week-learn.png`、`docs/acceptance-three-week-review-history.png`、`docs/acceptance-three-week-artifact-loop.png`。
- 当前边界：情景题仍是规则模板，不是课程片段级深选项；内置 AI / AI PM 内容池仍需深化；跨周 action API 返回 workspace 默认周的问题仍待修；旧作品级展示仍需下一轮 UI 降噪。
- 准确下一步：深化 AI / AI PM 自带内容池和课程片段专业性判断；优化行动卡标题与节奏；再把情景判断升级成与具体课程片段相关的低启动深选项。

## 2026-08-29 内容池切片补强

- 在内容判断与行动卡重设计之后，继续补强内置 AI / AI PM 内容池：`ResourceMapping` 新增可选字段 `segmentFocus`、`qualityRationale`、`skipGuidance`、`learnerAction`。
- 已为 Google ML Crash Course、NIST AI RMF、Gemini Prompting、OpenAI Evals、NIST AI 600-1 和工具调用文档补充片段级判断：本阶段只看哪段、为什么可信、先跳过什么、看完做什么。
- `contentJudgment` 会优先展示课程片段和专业性依据；`/learn` 材料取舍卡新增“为什么可信 / 看完做什么”。
- `weeklyActionPlan` 的标题改为学习节奏表达：先搞懂、看例子、做一版、判断题、收个口、小框架、复测，减少同节点活动平铺重复感。
- 情景判断四个选项已加长，用“继续补课 / 先做判断 / 换更难材料 / 只收藏”表达常见学习状态，降低用户从零组织证据的负担。
- 更新 `docs/product/TRELLIS_DAILY_USABLE_2_0.md` 与 `memory/sessions/2026-08-29-content-judgment-action-plan.md`。
- 验证通过：`npx tsc --noEmit --incremental false`、`npm run lint`、`npm run build`、`node --test --test-isolation=none "tests/learning-domain/*.test.ts"`（198/198）、`npm run acceptance:three-week-loop`。构建仍有 `gray-matter` direct eval 既有警告。
- 当前边界：内容片段仍是手工 curated 字段，不是自动全文解析；情景题仍是节点模板，不是真正按课程原文生成；行动卡节奏已有区分，但周计划仍可能围绕同一节点连续生成多张卡。
- 准确下一步：让周计划编排跨节点/跨活动类型更像一周学习节奏，或先修跨周 start/evidence/review 返回活动所属周 workspace 的 API 体验问题。

## 2026-08-29 最终交付情景迭代补充

- 本轮已实现 `/learn` 面向最终交付的轻启动补强：`weeklyActionPlan` 读模型按修订/待评审/进行中/主推进排序，小容量周主推进收窄到 3-4 张。
- `/learn` 材料取舍区只直接展示前 6 个材料判断，其余后续/参考材料折叠，避免资料墙干扰本周行动。
- `startActivity`、`submitEvidence`、`reviewEvidence` 现在返回活动所属周 workspace；第 2/3 周执行不会跳回当前自然周。
- `db/schema.ts` 已补齐活动类型枚举：`quiz`、`reflection`、`integrated_task`、`retest`。
- 验证：`npx tsc --noEmit --incremental false`、`node --test --test-isolation=none "tests/learning-domain/*.test.ts"`（199/199）、`node --test tests/*.test.mjs`（6/6）、`npm run lint`、`npm run build`、`npm run acceptance:three-week-loop` 均通过。build 仍有既有 `gray-matter` direct eval warning。
- 下一步：继续做 `/learn` 第一屏 UI 降噪和真实交付包装前的 D1/部署预验收。

## 2026-08-29 Course Slicer v1

- 参考 OpenMAIC 后，产品路线明确：OpenMAIC 是主题/材料生成完整互动课堂；Trellis 保持为已有课程/资料的分诊、切片和本周行动编排。
- 新增 workspace 读模型 `courseSlices`，从现有 `contentJudgment`、活动 `inputRefs` 和内容包字段推导，不新增数据库表。
- `CourseSlice` 包含材料标题、片段角色、片段范围、选择理由、预计时间、看完动作、看完问题、跳过原因和关联活动。
- `weeklyActionPlan` 新增 `courseSliceIds`，行动卡能绑定具体课程片段。
- `/learn` 新增“课程切片”区；本周必看片段直接展示，后续/参考/跳过片段折叠。活动抽屉也展示当前行动绑定的课程切片。
- `npm run acceptance:three-week-loop` 新增 `learn page renders course slicer` 检查并通过。
- 验证通过：`npx tsc --noEmit --incremental false`、`node --test --test-isolation=none "tests/learning-domain/*.test.ts"`（199/199）、`node --test tests/*.test.mjs`（6/6）、`npm run lint`、`npm run build`、`npm run acceptance:three-week-loop`。build 仍有既有 `gray-matter` direct eval warning。
- 下一步：把用户粘贴的课程大纲/视频目录解析成多个 slice；在 `/workbench` 材料卡展示切片计数；为切片增加初学者难度、练习密度和宣传风险判断。

## 2026-08-30 交付前三轮功能完善

- 已按交付前 3 轮计划完成 Course Slicer v2、轻启动措辞降噪和交付包装基础。
- Course Slicer v2 支持用户粘贴课程目录/视频目录/文章目录/摘要后切成多个 `courseSlices`，并标记本周主线、后续再用、只作参考、暂不碰；偏高阶片段默认跳过，行动卡绑定具体 slice。
- `/workbench` 材料卡显示切片统计；新增材料后刷新 workspace，切片计数即时可见。
- `/learn` 计划历史折叠为紧凑 summary，露出最近周 key；反馈文案从作业/证据提交调整为轻反馈、小产出和深度选择。
- 新增交付材料：`docs/product/TRELLIS_PORTFOLIO_CASE_STUDY.md`、`docs/engineering/TRELLIS_3_MIN_DEMO_SCRIPT.md`、`docs/architecture/TRELLIS_DELIVERY_ARCHITECTURE.md`。
- 新增 `scripts/delivery-precheck.mjs` 和 `npm run delivery:precheck`，检查 README、部署说明、case study、demo script、架构说明、三周验收截图和 `.openai/hosting.json`。
- 验证通过：`npx tsc --noEmit --incremental false`、`node --test --test-isolation=none "tests/learning-domain/*.test.ts"`（200/200）、`node --test tests/*.test.mjs`（6/6）、`npm run lint`、`npm run build`、`npm run acceptance:three-week-loop`、`npm run delivery:precheck`。
- 构建仍有既有 `gray-matter` direct eval warning 和 vinext 动态路由静态分类提示，不阻塞构建。
- 当前边界：课程切片仍是规则版目录/摘要解析；不自动抓取完整视频、PDF、字幕；外部 AI 仍是增强项不是依赖。
- 准确下一步：做 UI 交付轮，把 `/learn` 第一屏继续压成“本次行动 + 本周只看片段 + 待处理事项”；随后做部署预演、远程 D1 migration 检查、生产 URL smoke test 和作品集页面包装。

## 2026-08-30 Round 4-5 交付收敛

- 已继续实现交付前 Round 4-5，重点从功能扩张转向 `/learn` 日用降噪和部署/作品集交付检查。
- `/learn` 第一屏改为三块焦点：本次行动、本周只看、待处理。用户打开后优先看到一个 next action、最多 3 个本周主线 course slice、以及待评审/需修订/复盘/下周/调整建议提醒。
- `/learn` 二级信息默认折叠：本周全部行动卡、本周材料取舍、学习产出、阶段作品闭环、本周看板、调整记录和系统状态。
- 活动抽屉优先显示“先做这一小段”：当前行动绑定的课程切片、sourceRange、afterWatchingPrompt、learnerAction；长文本证据改为补充入口，只有作品任务显示“提交作品证据”。
- `/workbench` 材料卡继续默认显示切片统计，全部切片放入 `details` 点击展开，避免资源页变成材料墙。
- 新增 `scripts/production-smoke.mjs` 和 `npm run smoke:production`。设置 `TRELLIS_BASE` 后检查线上 `/learn`、`/workbench`、`/api/learning/workspace`、`/api/learning/week-review`；未设置时跳过。
- `scripts/acceptance-three-week-loop.mjs` 增加 UI 验收：第一屏三块焦点、活动抽屉优先显示课程切片和轻反馈。
- 文档已同步：README、`docs/engineering/DEPLOYMENT_RUNBOOK.md`、`docs/engineering/TRELLIS_3_MIN_DEMO_SCRIPT.md`、`docs/product/TRELLIS_PORTFOLIO_CASE_STUDY.md`、`docs/product/TRELLIS_DAILY_USABLE_2_0.md`。
- 验证通过：`npx tsc --noEmit --incremental false`、`node --test --test-isolation=none "tests/learning-domain/*.test.ts"`（200/200）、`node --test tests/*.test.mjs`（6/6）、`npm run lint`、`npm run build`、`npm run acceptance:three-week-loop`、`npm run delivery:precheck`。`npm run smoke:production` 未设 `TRELLIS_BASE` 时按设计跳过。
- 构建仍有既有 `gray-matter` direct eval warning 和 vinext 动态路由分类提示，不阻塞构建。
- 当前边界：尚未真实线上部署；production smoke 需有部署 URL 后再跑。手机端只做基础堆叠，不作为视觉主交付。课程切片仍是规则版目录/摘要解析。
- 准确下一步：部署前应用远程 D1 迁移 `drizzle/0012_week_reviews.sql`，部署后设置 `TRELLIS_BASE` 跑 `npm run smoke:production`；随后整理作品集截图和 draw.io 功能架构图。

## 2026-08-30 Course Intelligence 重构启动

- 用户审查确认当前产品中心错误：固定内容包、Stage Path、Course Slicer 和作品/证据展示不能证明 Trellis 会理解领域与课程，也不能回答 DeepLearning.AI 大型目录如何取舍。
- 新产品中心确定为领域智能、课程智能和个人课程编排；Trellis 对“学什么、为什么、学到哪里、现在做什么、何时退出、卡住后如何继续”负责。
- 新增独立 Course Intelligence 契约 `lib/learning/intelligence/course-intelligence.ts`：Course Genome、章节节点映射、课程角色、阶段组合、退出条件、来源引用和发布检查。
- 新增 DeepLearning.AI golden benchmark `tests/learning-domain/course-intelligence.test.ts`：五门代表课程被压缩为一门主课和少量指定章节；局部采用无章节、阶段章节无映射会阻止发布。
- 新增 `docs/product/TRELLIS_COURSE_INTELLIGENCE_PRODUCT_CONTRACT.md` 与 `docs/engineering/TRELLIS_REUSE_AND_REBUILD_AUDIT.md`。
- 验证：tsc 通过；新增文件 eslint 通过；新增测试 3/3；完整领域测试 203/203。
- 本轮没有接入模型、真实目录采集、数据库或前端，不宣称已经实现课程智能。
- 准确下一步：实现内置模型网关的结构化课程解析；增加来源快照与课程版本；采集 DeepLearning.AI 公开目录；模型输出通过 Course Intelligence Eval 后才能进入候选内容包。
