# 仓库交付标准

适用范围：Trellis 当前交付树及 GitHub 分支管理。标准关注可理解、可复现、可维护；文件少不是质量指标。当前实现与检查结果只记在[项目状态](PROJECT_STATUS.md)。

## 开源仓库的可借鉴做法

查阅日期：2026-09-16。仅比较官方仓库公开文件，不以 Star 数量或视觉印象评估工程质量。

| 官方仓库 | 可核查的组织方式 | Trellis 采用的做法 |
|---|---|---|
| [shadcn/ui](https://github.com/shadcn-ui/ui) | README 将产品说明、文档、贡献和许可分开；根目录仍保留必要工具配置 | README 服务首次访问者，详细规则进入各自文档；保留真实构建配置 |
| [Excalidraw](https://github.com/excalidraw/excalidraw) | 展示产品与功能，同时提供开发和贡献入口，代码按应用/包组织 | 先说明产品用途与已有能力，再提供完整开发路径；不照抄其多包架构 |
| [TanStack Query](https://github.com/TanStack/query) | 产品文档、贡献说明、示例、包和自动化有明确位置 | 文档按用途导航，测试和验收脚本保留明确责任；不为整齐添加发布系统 |

这些仓库同样存在隐藏配置和维护文件。应删除的是无当前用途、重复或不适合交付的内容，不能把隐藏目录、迁移或旧名称测试一概当垃圾。

## 六条验收标准

1. **入口清楚。** README 回答产品是什么、当前能做什么、怎样开始、去哪里贡献。它不是会话记录或评审目录。
2. **新克隆可接续。** 依赖有锁文件，环境有无秘密示例，数据初始化与内存迁移验证明确区分。运行不依赖原机器的个人资料；构建和验证命令可找到。
3. **一类事实一个入口。** 实现状态在 PROJECT_STATUS，设计在当前产品规格，长期取舍在架构决策。旧规格、旧摘要和清理清单由 Git 历史追溯。
4. **源码与产物分开。** 保留源码、迁移、测试、必要部署绑定和精选证据。生成物、个人资料、真实环境变量、数据库、完整日志不进入 Git。
5. **检查阻止回退。** CI 同时执行工程检查和交付预检；链接目标必须实际进入交付树，不能依赖被忽略的本机文件。提交模板要求报告真实验证及未验证范围。
6. **分支有用途。** 保留 main、正在协作的开发分支和仍含独立提交的分支。清除已合并或全部补丁等价合入的旧分支前，核对远端最新 SHA 并留本地恢复依据。未合入分支不能按年龄盲删。

## 目录与保留边界

| 路径 | 保留规则 |
|---|---|
| app/、lib/、src/、public/ | 当前源码；是否删除按依赖与测试判断 |
| db/、drizzle/ | Schema 和迁移，不随目录整理删除或重排 |
| worker/、build/、.openai/ | 实际运行/构建源码与非秘密托管绑定；build 不是 dist |
| tests/、scripts/acceptance/ | 可复现验证；输出写 outputs |
| scripts/compatibility/ | 明确旧运行时边界的有效回归，不代表新版交互验收 |
| docs/product/ | 当前产品契约、分析、交互规格；保留用户要求的详细设计 |
| docs/product/evidence/ | 带日期、版本、范围的精选资料和合成输入截图 |
| docs/architecture/ | 当前架构、模型运行、关键决策 |
| memory/handoff/current.md | 简短当前交接，不复制整个状态报告 |
| memory/sessions/latest.md | 最新交付摘要，覆写更新；过去摘要保留于 Git 历史 |
| memory/profile/、memory/routes/、.agents/、.vscode/ | 本机资料与工具，忽略提交 |
| outputs/、dist/、.next/、.mastra/、node_modules/ | 中间产物或依赖，忽略提交 |
| .wrangler/、.env.local、.dev.vars | 运行数据与秘密；不提交，也不能为清理随意删除 |

## 公开发布的独立边界

当前树可审阅不等于 Git 历史已脱敏。仓库曾保存个人资料；公开前需单独核查历史、其他分支、Release 和 Actions 产物。本轮不重写历史、不改变可见性、不修改线上运行数据。

`.openai/hosting.json` 的 project_id 是现有非秘密托管绑定，构建会打包它；保留以确保交付继续连接原项目。另建托管项目时应配置自己的绑定，不能把原 project_id 当通用模板。

许可证由所有者明确选择。GitHub 文档说明公开可见与开源授权不同；没有许可证不代表任意再分发授权。此处不替所有者添加 MIT 等许可。[GitHub 许可说明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)
