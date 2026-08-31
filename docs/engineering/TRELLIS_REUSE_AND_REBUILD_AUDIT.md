# Trellis 重构复用审计

## 结论

现有系统保留学习运行底座，停止继续扩展作品集展示层。新的产品中心是领域智能、课程智能和个人课程编排。

## 保留

- D1 持久化、owner 隔离和恢复；
- service / store / read model 分层；
- weekly plan 作为执行容器；
- activity 生命周期；
- node progress 作为个人知识状态的存储基础；
- user resources 作为用户材料入口；
- adjustment 作为 Decision Ledger 的迁移基础；
- 自动测试、浏览器验收和部署检查。

## 改造

- `CourseMaterialAnalysis`：由关键词和粗粒度覆盖升级为 `Course Genome`；
- Course Slicer：由目录切行升级为章节解析、节点映射和深度判断；
- planner：由固定节点序列升级为目标投影、图约束和课程组合；
- evidence：前台转为低负担学习信号，底层保留可追溯状态；
- week review：降低产品优先级，只在有有效学习信号后出现；
- growth map：连接版本化领域图和个人状态。

## 冻结或退出用户主流程

- 固定 AI PM 八周 Stage Path；
- 前三周动态演示；
- 默认作品闭环；
- Quality / Eval / Mastra runtime 面板；
- API Key 主流程；
- 当前预设画像和假确认；
- 以行动卡数量表达时间容量。

## 工程顺序

1. 固定 DeepLearning.AI 目录 benchmark 和发布门槛；
2. 建立 Course Genome、章节映射、课程取舍和课程组合契约；
3. 接入内置模型网关，形成结构化课程解析；
4. 建立来源快照、课程版本和变更检测；
5. 建立领域图候选、发布和回滚；
6. 实现目标到图、图到课程组合的个人投影；
7. 接回 weekly plan 和 activity 执行底座；
8. 接入低负担学习信号和动态调整；
9. 最后重做学习、成长和工作台前台。

## 本轮边界

本轮只新增独立 Course Intelligence 契约、确定性发布检查和 benchmark，不修改现有正式学习状态，不新增数据库和前端，不宣称已经实现模型解析。
