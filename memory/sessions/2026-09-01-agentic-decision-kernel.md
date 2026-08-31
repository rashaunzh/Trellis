# 2026-09-01 Agentic 决策内核收口

## 目标

完成进入产品功能优化前的最后一轮架构修缮，使课程判断、路线确认、学习反馈和来源演进共享同一决策与工作流内核。

## 完成

- 新增 `0016_agentic_decision_kernel.sql`：统一决策、append-only 事件、课程 revision、candidate Eval/影响和来源检查状态。
- 建立四条正式 Mastra 工作流：课程分析、课程编排、学习调整、来源演进；业务状态仍由 D1 持有。
- 建立 Curriculum Solver v2：发布数据硬约束、前置闭包、单阶段主线、章节选择、显式缺口和软评分。
- 正式 API 增加 workflow、decision accept/reject、learning feedback、candidate 草稿和 source review；旧 mutation 在 production 返回 410。
- 模型网关改为主备 provider 槽位，统一结构验证、缓存、失败切换和运行记录；无 Key 继续使用发布基线。
- 内部 candidate 评审从整段 JSON 改为结构化课程、章节和映射编辑；blocking issue 未清空不能发布。
- Worker 增加每周来源扫描；托管身份增加 trusted host 与 workers.dev 拒绝规则。
- 新增 Agentic 内核 HTTP 验收、双模型 golden benchmark、生产 smoke 和交付预检项。

## 验证

- TypeScript、ESLint 通过。
- 领域测试 225/225，通过；核心修补回归 26/26，通过。
- Node 构建契约测试 6/6，通过。
- production build、17 个迁移、秘密扫描、delivery precheck，通过。
- Agentic HTTP 验收通过：reset、catalog、intake suspend、workflow read、confirm resume、准确章节、feedback adaptation、legacy 410、刷新后清空。
- 真实主备模型 benchmark 因本机没有 provider 凭据按设计跳过。

## 未完成的外部门

- Cloudflare 尚未完成远程 D1 `0013-0016`、托管身份联调和线上 production smoke。
- 主备模型凭据未配置，真实 golden benchmark 尚未执行。
- 首批 candidate 与代表课程仍需人工内容评审，不应由自动化测试替代。

## 下一步

进入功能优化：先改多课程取舍与方案检查，再改当前学习动作与卡住后的恢复体验；不再新增底层运行时。

