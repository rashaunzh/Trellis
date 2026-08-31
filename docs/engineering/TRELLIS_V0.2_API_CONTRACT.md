# Trellis V0.2 API Contract

> 全部接口位于 `app/api/learning/`，V0.2 学习编排闭环。V0.1 遗留接口（`progress`、`proposal` 根路由、`content`）已删除（2026-08-20）。

## 通用约定

- **Owner 隔离**：所有接口通过 `x-trellis-owner-id` header 识别匿名用户；`ownerOf(request)` 优先读 header（正则 `^[A-Za-z0-9_-]{8,128}$` 校验），无/非法回退 `DEFAULT_OWNER = "trellis-owner"`。这是匿名隔离不是鉴权。
- **响应形状**：写接口返回 `{ workspace }`（聚合读模型）；错误返回 `{ error }` + 4xx/5xx。
- **幂等性**：诊断/确认/重置等按业务语义幂等；活动/证据创建用稳定 id。
- **验证**：领域测试 `tests/learning-domain/`（node --test 直跑 TS）。

## 接口清单

### GET /api/learning/workspace
- input: 无（owner 来自 header）
- output: `{ workspace }`——profile / route / adjacentBranches / edges / weeklyPlan / activities / nodeProgress(含中文 title) / evidence / adjustments / userResources / workbench(resources+tools)
- state effect: 无（纯读；副作用仅 seedContent 幂等种子）
- errors: 500（缺 DB）
- tests: api-loop "空 workspace"、owner-isolation

### POST /api/learning/diagnostic
- input: `{ goal, weeklyMinutes, preference, selfReport? }`
- output: `{ workspace }`（profile.status=proposed，含推荐路线）
- state effect: 创建/更新 profile + 初始化 nodeProgress；写一条诊断记录
- errors: 400（goal 空）、400（weeklyMinutes 超 1-20h 范围 30-1200）
- idempotency: 重复诊断覆盖画像（同 owner）
- tests: api-loop "diagnostic 生成初始画像与推荐路线"

### POST /api/learning/proposal/confirm
- input: `{}`
- output: `{ workspace }`（profile.status=confirmed + weeklyPlan + activities）
- state effect: profile 置 confirmed；创建本周计划（stableId 幂等）+ 按容量生成活动
- errors: 400（未诊断）、400（已确认重复确认幂等返回）
- tests: api-loop "confirm 后 workspace 能读到已确认计划和活动"

### POST /api/learning/activities/:id/start
- input: `{}`
- output: `{ workspace }`
- state effect: 活动 planned→in_progress；节点 beginLearning→growing
- errors: 404（活动不存在/非本人）、400（状态不允许）
- tests: api-loop 活动闭环

### POST /api/learning/activities/:id/evidence
- input: `{ content, evidenceType?, externalUrl? }`
- output: `{ workspace }`（evidence 进入 submitted）
- state effect: 创建 evidence（draft→submitted）；活动→evidence_submitted
- errors: 400（内容空）、404（活动不存在）
- tests: api-loop 修订循环

### POST /api/learning/evidence/:id/review
- input: `{}`
- output: `{ workspace, assessment }`——`{ verdict: accepted|needs_revision, reasons[], missing[], suggestedLevel, nextAction }`
- state effect: 接受→活动 completed、节点 evidenceAccepted→validated（证据驱动，活动完成≠节点验证）；退回→活动回 in_progress、节点不迁移；评估器结论→adjustmentAdvisor 建议（proposed）
- errors: 404、400（证据状态非 submitted）
- tests: api-loop 短证据退回/修订通过、核心规则 1/2

### POST /api/learning/replan
- input: `{ weeklyMinutes? }`
- output: `{ workspace }`
- state effect: 保留证据/节点进度/已产生证据活动；删除本周无证据的 planned/in_progress 活动；重新生成活动；写 activity_replan(accepted) 调整记录
- errors: 404（未诊断）、400（路线未确认）
- tests: api-loop "重排本周"、`scripts/legacy/acceptance-replan.py` 32/32

### POST /api/learning/adjustments/:id/confirm
- input: `{}`
- output: `{ workspace }`
- state effect: adjustment proposed→accepted
- errors: 404、400（非 proposed）
- tests: 调整确认链路

### POST /api/learning/adjustments/propose
- input: `{ nodeId, adjustmentType, reason?, summary? }`
- output: `{ workspace }`（新 adjustment 为 proposed）
- state effect: 创建用户主动调整建议
- errors: 400（类型非法）

### POST /api/learning/nodes/:id/skip
- input: `{}`
- output: `{ workspace }`
- state effect: 生成 isSkipValidation 验证活动（更严评估）；前置缺口拒绝
- errors: 400（前置未满足）、404
- tests: 跳学规则 3/4

### POST /api/learning/reset
- input: `{}`
- output: `{ workspace }`（回未诊断起点）
- state effect: 按 owner 清空 profiles/weekly_plans/activities/node_progress/evidence/adjustments（先子后父）；**不清** api_config 与 user_resources
- tests: owner-isolation "reset 只清当前 owner"

### GET/POST /api/learning/api-config
- GET: `{ configured, enabled, baseUrl, model, keyMasked }`（**绝不下发 apiKey**）
- POST: `{ baseUrl, apiKey?, model, enabled }`——key 为空保留旧值；key 只存服务端表
- tests: 配置保存→脱敏读回

### GET/POST /api/learning/resources/inbox（工作台收集箱，V0.2 新增）
- GET: `{ resources: [{id,title,type,content,sourceUrl,relatedNodeIds,createdAt}] }`
- POST: `{ title, type: link|note|tool|resource, content?, sourceUrl? }` → `{ resources }`
- state effect: 持久化到 learning_user_resources（ownerId 边界）；**独立于学习状态**（无 profile 也可用，不走 getWorkspace 早退分支）
- errors: 400（标题空）
- tests: E 轮端到端（无 profile 读写/刷新持久化/多 owner 隔离）
