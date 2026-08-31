# 2026-08-30 mattpocock/skills 安装与分析

## 安装

- 执行 `npx skills@latest add mattpocock/skills`。
- CLI 识别 Codex，并将 37 个 skill 安装到项目 `.agents/skills/`。
- 其中 3 个附带 shell 脚本；其余主要是 `SKILL.md`、模板和说明文件。
- 安全扫描对 `code-review`、`writing-shape` 和 `implement-spec` 给出不同扫描器的风险提示。静态检查未发现下载后直接执行或自动删除仓库内容；`wizard` 会生成可写 `.env` 和 GitHub secrets 的交互脚本，必须保持用户显式触发。

## 对 Trellis 的启发

- `teach` 的 Mission、Resources、Learning Records 与 Trellis 当前的目标、来源注册表和学习状态高度相关。
- Learning Record 只记录已证明的非平凡理解，不记录“看过什么”，适合替代粗糙的完成/证据堆积。
- `wayfinder` 的 destination、frontier、fog of war、blocking edges 适合解释课程编排：领域图可以完整，但前台只暴露当前可推进边缘和尚不能判断的缺口。
- `to-tickets` 的 tracer-bullet 与 blocking edge 适合约束行动生成：每个行动应形成独立能力增量，且前置明确。
- `ask-matt` 的路由思想适合做内部编排策略，不适合把多个 Agent 名称暴露给学习者。
- `loop-me` 的 push-right checkpoint 支持 Trellis 的低打扰原则：系统先做完课程判断，只在高影响路线调整时让用户确认。

## 不应直接采用

- `teach` 默认由 Agent 自制 HTML 课程，与 Trellis“原课程负责教学，Trellis 负责取舍和推进”的边界冲突。
- engineering 的 idea-to-ship 固定流程不能直接映射为所有学习主题的固定阶段。
- issue tracker、PR、worktree 和多 agent 并行属于软件交付机制，不应进入普通学习者界面。
- 完整 Mission/Resources/Learning Records 文件结构可作为领域设计参考，不应要求用户手工维护。

## 待讨论提案

把 Trellis 连续学习状态重构为四个内部对象：`Mission Brief`、`Curriculum Decision`、`Learning Record`、`Learning Frontier`。前台仍只显示目标理解、当前章节、停止条件和必要确认。
