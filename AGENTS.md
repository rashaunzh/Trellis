# Trellis 仓库协作规则

## 产品与当前入口

产品正式名称为 Trellis。当前责任是将 AI 学习目标与材料转为有依据的路线、活动和连续记录；教学主要使用外部课程。

开始前：
1. 检查 git status 并拉取最新分支；发生冲突时停止，不覆盖其他设备工作。
2. 阅读 memory/handoff/current.md 与 docs/engineering/PROJECT_STATUS.md。
3. 产品工作阅读 docs/product/TRELLIS_COURSE_INTELLIGENCE_PRODUCT_CONTRACT.md；界面工作按需读 docs/product/TRELLIS_DESKTOP_UPDATE_DESIGN_2026-09-14.md 的相关点击规格。
4. 涉及持久状态或 AI 写入时阅读对应架构和 memory/decisions/README.md。
5. 与个人计划有关时，可读取本地 memory/profile/preferences.yaml 和 memory/routes/；新克隆没有这些文件是正常情况，不虚构用户事实。

## 设计与执行

- 桌面核心闭环优先，手机专项在桌面验收之后。
- 学习、成长、工作台为当前一级入口；路线、阶段、项目和活动不能当作同义词。
- 周安排是区间承诺，时间按 15 分钟递增；不增加今日、打卡或实时计时器。
- 目标覆盖、活动执行和能力证据分开；来源只有主页时不得宣称章节直达。
- AI 生成候选；重要正式计划或能力变化遵循提案、审阅、确认。材料不足和模型不可用需真实表达。
- 保持模型中立，基础流程不要求付费模型。D1 为业务事实源，工作流快照不替代业务状态。
- 用户确认目标和现实约束；具体交互、能力前置、活动与验收方案由协作者在边界内完成。
- 实现前用简体中文说明目标、范围、验收；跨文件完成可测试切片，避免无关重构。
- 高风险、不可逆变化先提出可审阅范围并确认；常规实现与验证不重复索要许可。

## 验证与交付

- 按变更运行必要检查，默认工程门为 npm run check；文档与仓库整理另运行 npm run delivery:precheck。
- 测试通过、设计完成、本地可用、线上验收和真实用户效果必须分开报告。
- 当前实现状态只维护在 docs/engineering/PROJECT_STATUS.md；下一版设计不是已经实现的功能。
- 结束前写一份简短 memory/sessions/ 记录并更新 current handoff，提交推送用于跨设备协作。
- 对个人路线或偏好的实质修改先提建议；不把推测写成事实。

## 资料与隐私

- 代码、可复现测试、当前规格、关键决策和带来源的精选证据进入 Git。
- 个人资料、机器设置、秘密、运行数据库和中间产物仅本地保留并忽略提交。不得提交 Cookie、令牌、密码、雇主机密或敏感简历。
- 本仓库保持私有；清理当前树不等于清除 Git 历史。改变可见性或重写历史需明确授权。
- 截图与日志先写 outputs，核验后再精选进入 docs/product/evidence；禁止用过时截图证明当前版本。
- 旧规格退出当前树，由 Git 历史追溯；避免平行 PRD 和多份“当前进展”。

## 协作工具与语言

说明性文档使用简体中文；代码标识、协议、路径和命令可用英文。

Issue/PR 使用 GitHub 仓库 rashaunzh/AI-Learning-OS，优先 gh CLI，见 docs/agents/issue-tracker.md。分诊标签见 docs/agents/triage-labels.md；领域词汇见 CONTEXT.md。
