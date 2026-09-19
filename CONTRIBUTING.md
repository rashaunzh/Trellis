# 参与 Trellis 开发

先阅读[项目状态](docs/engineering/PROJECT_STATUS.md)和[开发指南](docs/engineering/LOCAL_DEVELOPMENT.md)。产品行为以[产品契约](docs/product/TRELLIS_COURSE_INTELLIGENCE_PRODUCT_CONTRACT.md)为边界，下一版界面按[交互规格](docs/product/TRELLIS_DESKTOP_UPDATE_DESIGN_2026-09-14.md)实施。设计内容与已实现功能分别报告。

## 提交问题

在本仓库 Issues 中说明使用场景、期望行为、实际行为和最小复现。附上源码版本、运行环境及脱敏截图；日志先检查是否含密钥、个人材料或账号信息。功能建议说明希望完成的用户任务，不只列按钮名称。

安全问题、令牌和个人数据不放入普通 Issue 或 PR。请通过仓库维护者公开联系方式私下报告；当前没有承诺公开安全报告服务或响应时限。

## 开发变更

1. 开始前检查 `git status`，拉取最新分支。发生冲突时保留双方工作。
2. 用 `codex/` 前缀创建任务分支；每个变更完成一个可测试的用户流程或明确工程任务。
3. 保留有效迁移、历史记录和兼容测试。涉及行为变化时给出场景、前后结果与验证。
4. 代码变更执行 `npm run check`；所有交付执行 `npm run delivery:precheck`。真实模型、浏览器与线上验证按任务需要分别执行。
5. PR 说明问题、变更结果、已执行检查及限制。影响当前能力时更新唯一的[项目状态](docs/engineering/PROJECT_STATUS.md)。

GitHub CLI 在克隆目录内使用当前 remote。多行 Issue/PR 正文先写文件，再用 `--body-file`；不要把 Shell 插值当文本转义。工具认证失败不等于 Git 推送凭据不可用，分别核对。

## 哪些内容进入 Git

保留源码、依赖锁文件、迁移、可复现测试、当前规格、关键决策和带版本/来源的精选证据。依赖、运行数据库、密钥、个人资料、详细日志和中间截图写入已忽略的目录。规则与目录说明见[仓库交付标准](docs/engineering/REPOSITORY_DELIVERY_STANDARD.md)。

旧规格与旧交付摘要由 Git 历史追溯，不新增平行的“当前进展”或按天堆积评审报告。跨设备协作只维护当前交接和一份最新摘要。

本项目基于 [MIT License](LICENSE) 开源。本指南面向所有访客；发布、变更可见性和改写历史按维护者明确授权执行。
