# Trellis

把 AI 学习目标和材料，变成有依据的学习路线、可执行的活动和连续记录。

Trellis 面向 AI 领域的自主学习者。主要教学来自外部课程；Trellis 帮助选择学习范围、安排顺序、记录问题，并根据学习反馈决定如何继续。

## 当前能力

- 从目标、每周投入和可选材料生成路线候选，审阅后采用。
- 保存和分析材料，区分实际读取范围、候选片段与正式采用。
- 开始、暂停和恢复活动，记录完成情况、学习位置及反馈。
- 在有限主题中提供补充讲解、选择题检查、逐题反馈和历史记录。

当前处于开发阶段。完整的导学、开放回答、反馈修订与跨次学习体验正在设计和实现中；详细边界见[项目状态](docs/engineering/PROJECT_STATUS.md)。

## 本地开发

需要 Node.js 22.13+（CI 使用 Node 22）、npm 和 Git。

```bash
git clone https://github.com/rashaunzh/Trellis.git
cd Trellis
npm ci
npm run db:verify
npx wrangler d1 migrations apply DB --local --config wrangler.migrate.json
npm run dev
```

访问 `http://127.0.0.1:5174/learn`。`db:verify` 在内存中验证迁移；下一条命令将待应用迁移写入本地开发数据库，先核对命令列出的迁移再确认。已有数据库不要删除重建；详情见[开发指南](docs/engineering/LOCAL_DEVELOPMENT.md)。Windows 执行策略拦截时可使用 `npm.cmd` 和 `npx.cmd`。

不配置模型密钥也可使用已发布基线。需要真实模型时，从 [.env.example](.env.example) 了解可选变量，按[模型配置](docs/architecture/MODEL_RUNTIME.md)设置本地或托管环境。

```bash
npm run check
npm run delivery:precheck
```

## 文档与贡献

- [文档导航](docs/README.md)：产品规则、设计、架构、开发与验证。
- [贡献指南](CONTRIBUTING.md)：问题反馈、变更范围、检查与提交。
- [项目状态](docs/engineering/PROJECT_STATUS.md)：已有能力、已验证范围和下一步。
- [部署指南](docs/engineering/DEPLOYMENT_RUNBOOK.md)：托管身份、数据迁移与发布。

## 代码布局

## 许可与开源

本项目基于 [MIT License](LICENSE) 开源，公开仓库为 [rashaunzh/Trellis](https://github.com/rashaunzh/Trellis)。欢迎通过 Issue 反馈问题或提交 PR。个人路线、个人偏好、机器设置与运行数据仅保留本地，不进入 Git；仓库内示例路线与演示数据均为通用内容，不代表任何真实用户。
