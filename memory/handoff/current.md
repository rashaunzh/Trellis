# Trellis 当前交接

> 旧交接历史因原文件包含非 UTF-8 字节，已原样保存在 `current.legacy-2026-08-30.md`。本文件从 Course Intelligence 重构后重新建立。

## 当前产品中心

Trellis 负责把用户目标和已有课程转化为有限课程组合、准确章节顺序、退出条件和连续学习状态。正式主链为：

`目标/已有课程 → 发布领域图 → Course Genome → 课程取舍 → 用户确认 → 准确章节 → 学习反馈`

## 已完成

- 10 个来源、30 门课程或专业参考、36 个 AI 领域节点的发布基线。
- Course Genome、章节节点映射、课程组合、发布检查和课程版本影响契约。
- 服务端模型网关：OpenAI-compatible、Zod、超时、重试、缓存和分析运行记录；无 Key 时发布基线可用。
- D1 迁移 `0013_course_intelligence.sql` 与 Course Intelligence repository/service。
- 正式 API：intelligence state、intake、material analyze、curriculum read/confirm。
- `/learn` 三态课程编排、`/grow` 长领域图、`/workbench` 辅助空间。
- DeepLearning.AI 总目录范围约束；AI PM 场景不把 ML 专项设为默认前置。
- `npm run acceptance:course-intelligence` 浏览器验收与四张截图。

最终验证：TypeScript 通过；领域测试 212/212；构建产物测试 6/6；lint、production build、课程智能浏览器验收和交付预检全部通过。构建仅有既有 `gray-matter` direct eval 与 vinext 路由分类提示。

## 复用与兼容

继续复用 D1、匿名 owner 隔离、周计划、活动、学习反馈和节点进度。固定 StagePath、假画像、六步展示、前三周动态演示、默认作品、Quality/Eval/Mastra 展示和关键词 Course Slicer 已退出正式入口，但兼容代码和历史数据尚未物理删除。

## 当前边界

- 本地 D1 已应用 0013；远程 D1 尚未迁移。
- 尚未线上部署，production smoke 未运行。
- 自动定期抓取、候选内容内部评审台和生产级私有材料解析尚未完成；服务层已有候选发布质量闸门。
- 内置模型环境变量未配置时运行 baseline 模式；未知课程明确为 `needs_analysis`。
- 课程更新只产生候选版本和影响报告，不自动迁移已确认用户路线。

## 准确下一步

1. 建立来源更新脚本和候选内容内部评审台，复用现有受控发布服务。
2. 完成远程 D1 `0013/0014` migration、部署和 production smoke。
3. 用真实用户目标复核 AI 产品路线的课程与章节选择质量，再扩充发布基线。
4. 确认历史兼容依赖后，再逐步删除旧固定路线与工程展示代码。

## 2026-08-31 审计修缮实施

- D1 published catalog 已成为课程、版本和章节映射的运行时真相；baseline 仅负责带 release marker 的首次发布。
- 新增 0014 canonical runtime：活动保留 curriculum/course version/unit/canonical node，轻反馈写入 LearningSignal 与 knowledge state。
- curriculum 激活现在可恢复、可重试；新材料模型分析先保存 candidate，不能直接进入正式路线。
- 浏览器 BYOK 写入和旧 D1 明文 Key 读取已停用；Next 升至 16.3.3，production audit 为 0 high/critical。
- `npm run check` 统一执行 typecheck、lint、15 个迁移、212 项领域测试、production build 和 6 项构建测试。
- 宿主认证邮箱现在映射为稳定、不可逆的 owner id；匿名 owner 仍保留作本地 fallback。
- candidate 已增加服务端发布闸门：低置信、缺失节点或映射不完整时拒绝进入正式 catalog。
- 浏览器验收覆盖下一准确章节推进和 390px；最新本地地址为 `http://127.0.0.1:5179/learn`。
- 实施报告：`docs/engineering/TRELLIS_REMEDIATION_IMPLEMENTATION_2026-08-31.md`。

公开发布仍未完成：完整账号授权、candidate 内部评审界面、远程 D1 0013/0014、线上部署和 production smoke 仍是阻塞项。

## 2026-08-31 仓库整理

- 已创建 `codex/trellis-production-remediation`，相对 `origin/main` 拆成三笔可审阅提交：运行时、产品界面、交付证据。
- 本地工作树干净；`npm run check`、`acceptance:course-intelligence` 和 `delivery:precheck` 全部通过。
- `.agents/`、`AGENTS.local.md`、`skills-lock.json` 与旧生成截图已隔离为本地工具/产物，不进入 Trellis 产品提交。
- 用户已确认远端为私有并授权同步 `memory/`；`codex/trellis-production-remediation` 已推送，仍未自动合并 `main`。
- 脚本已按 `acceptance / release / compatibility / legacy / lib` 分类，当前 Course Intelligence 不再依赖旧作品集验收模块。
- 文档索引已按当前契约、当前工程、交付、历史兼容和归档重写；本地临时浏览器产物已清理。
- 已安全删除完全并入 main 且远端已删除的 `feat/evidence-review-engine-v03` 本地分支；其他未合并分支保留。

## 2026-08-30 全工程审计

- 已按用户要求安装并完整盘点 `mattpocock/skills` 的 37 个 skill；这些 skill 只用于 Trellis 工程分析，不作为产品功能灵感。
- 完整报告：`docs/engineering/TRELLIS_FULL_ENGINEERING_AUDIT_2026-08-30.md`。
- 当前最大风险是 48 个 tracked 修改和 104 个 untracked 项未形成可回滚版本。
- Course Intelligence 的主要工程断点是 D1 catalog 仍依赖代码 baseline，以及 canonical graph 被桥接回 legacy node。
- 补充发布阻塞：每请求 seed、curriculum activation 非原子、迁移 journal 分叉、CI 未运行领域测试、legacy BYOK 明文存储、生产依赖 4 个 high 漏洞。
- 当前判断：本地 baseline 演示 Go；真实用户连续使用和公开生产部署 No-Go。
- 下一步先建立 fixed point、glossary/ADR 和 decision map，再处理发布阻塞并实现 published catalog 与 canonical learning runtime 两条 tracer-bullet。
