# Trellis 作品集证据矩阵

> 状态：中高级作品集准备  
> 日期：2026-09-02

## 作品集主张

Trellis 的核心能力不是生成更多课程，而是把学习目标、已有材料、课程取舍、当前片段、反馈信号和成长状态组织成连续闭环。

## 证据矩阵

| 作品集主张 | 产品证据 | 工程证据 | 内测观察 |
| --- | --- | --- | --- |
| 用户不缺课程，缺取舍 | 课程组合只采用少量主线和选定章节，暴露缺口 | Course Intelligence 课程取舍和发布图验收 | 用户能否说出为什么不学全部课程 |
| 学习需要可恢复 | 学习页显示当前片段、暂停原因、已打开未反馈 | `resumeState`、活动开始/暂停/完成字段 | 用户回来后能否说出上次停在哪 |
| 信任来自准确来源 | 来源显示精度标签，允许个人补定位 | `sourceResolution` 和个人 scope override | 用户是否理解课程主页与准确片段的区别 |
| 动态调整必须可解释 | 最近变化显示触发信号、调整摘要、是否已应用 | `adaptationTimeline` 持久化并排序稳定 | 用户是否知道系统为什么改变后续动作 |
| 成长不能等同完成 | 成长页只强调真实能力信号和验证方式 | canonical knowledge state 与 Learning Signal | 用户是否理解计划中不算成长 |
| 工作台是辅助上下文 | 资源显示附加状态，可在学习页轻量引用 | resource attachment API 与输入引用 | 用户是否区分参考材料和候选课程 |

## 必备截图

- `docs/acceptance-continuous-learning-proposal.png`：有限课程组合和缺口。
- `docs/acceptance-continuous-learning-learn.png`：当前片段和来源定位。
- `docs/acceptance-continuous-learning-feedback.png`：轻反馈入口。
- `docs/acceptance-continuous-learning-grow.png`：当前路线、能力信号、下一里程碑。
- `docs/acceptance-continuous-learning-workbench.png`：工作台资料上下文。
- `docs/acceptance-continuous-learning-mobile.png`：手机端主动作与导航。
- `docs/acceptance-internal-test-*.png`：内部测试闭环补充截图。

## 中高级 PM 评价点

- 问题定义：把“课程太多”重新定义为“学习判断无法持续”。
- 信息架构：三页结构承载学习、成长和辅助资料，不把后台对象升为主导航。
- 取舍能力：明确不做课程市场、打卡、日历、多 Agent 展示和完整知识库。
- 可信机制：来源、章节、知识节点、课程取舍和反馈变化均可追溯。
- 验证意识：先内部测试，再外部测试；先证明真实使用闭环，再谈生产扩张。

## 当前缺口

- 缺少 5 次真实人工内测记录；
- 缺少用户卡点的迭代前后对比；
- 线上部署和 production smoke 未完成；
- 作品集讲述仍需从历史“课程切片”更新为当前“连续学习编排”。
