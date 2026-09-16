# Trellis

Trellis 帮助 AI 领域的自主学习者，把目标和已有材料转化为有依据的路线、可执行的学习活动和连续记录。课程教学主要留在原课程，Trellis 负责材料取舍、学习顺序、开始与恢复，以及依据反馈提出调整。

**当前阶段：已有可运行功能基础，正在进入桌面交互更新。** 最新设计尚未全部实现；本仓库不宣称已经完成公开产品验收或验证长期学习效果。

## 审阅入口

| 想了解什么 | 文档 |
|---|---|
| 当前实现程度、验证和下一步 | [项目进展](docs/engineering/PROJECT_STATUS.md) |
| 当前产品责任与边界 | [产品契约](docs/product/TRELLIS_COURSE_INTELLIGENCE_PRODUCT_CONTRACT.md) |
| 下一版逐点击设计 | [桌面更新设计](docs/product/TRELLIS_DESKTOP_UPDATE_DESIGN_2026-09-14.md) |
| 数据流与 AI 写入边界 | [架构](docs/architecture/TRELLIS_COURSE_INTELLIGENCE_ARCHITECTURE.md) |
| 本地运行与测试 | [开发指南](docs/engineering/LOCAL_DEVELOPMENT.md) |
| 部署条件与验收边界 | [发布指南](docs/engineering/DEPLOYMENT_RUNBOOK.md) |
| 清理范围与可审阅边界 | [仓库整理记录](docs/engineering/REPOSITORY_CLEANUP_2026-09-14.md) |

## 本地启动

使用 Node.js 22.13 或更新的受支持版本，推荐按 CI 使用 Node 22。

```bash
npm ci
npm run db:verify
npm run dev
```

默认入口为 `http://127.0.0.1:5174/learn`。已有本地数据库不可通过删除状态目录初始化；完整设置步骤见开发指南。

```bash
npm run check
npm run delivery:precheck
```

测试通过证明指定样例与工程约束通过，不代表真实模型输出、线上登录或学习效果已经验收。

## 仓库内容

`app/` 是界面与 API，`lib/` 是业务逻辑，`db/`、`drizzle/` 是状态与迁移，`worker/`、`build/` 是部署入口和构建适配，`scripts/`、`tests/` 提供可复现验证。详见[目录契约](docs/development/REPOSITORY_STRUCTURE.md)。

个人路线、个人偏好、机器设置与运行数据仅保留本地，不进入 Git。示例路线与演示数据均为通用内容，不代表任何真实用户。

## 开源与参与

本项目基于 [MIT License](LICENSE) 开源。欢迎通过 Issue 反馈问题或提交 PR；参与前请阅读 [AGENTS.md](AGENTS.md) 与 [CONTEXT.md](CONTEXT.md) 了解领域词汇与协作约定。

Git 历史中可能包含项目早期作为个人工具时的提交；当前树已清除此类内容，历史提交不代表当前发布内容。
