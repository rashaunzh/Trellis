# 2026-08-24：Ponytail 集成到 DeepSeek Harness

## 任务

分析 GitHub 仓库 [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)（10.9 万 star / 6041 fork / MIT / JavaScript），并按用户确认的方案把它集成进本机 DSH（DeepSeek Harness，web profile）。

## 分析结论

- ponytail 是「懒惰资深工程师」行为规则包：7 级阶梯（YAGNI → 复用代码库 → 标准库 → 平台原生 → 已装依赖 → 一行 → 最小可用），强调先理解再动手、绝不削减校验/安全/可访问性、`ponytail:` 注释标记有意简化、非平凡逻辑留一个可运行检查。
- 官方基准（Claude Code 改真实 FastAPI+React 仓库，Haiku 4.5）：代码量 -54%、token -22%、成本 -20%、时间 -27%，安全性 100%。
- DSH 集成通道实测：① AGENTS.md 指令链（`~/.dsh/AGENTS.md` + 项目 `AGENTS.md`/`CLAUDE.md` + `AGENTS.local.md` 叠加层）；② 技能系统（`~/.agents/skills` 等 5 个根，`<name>/SKILL.md` 格式）；③ MCP 客户端（只桥 tools 不桥 prompts，ponytail-mcp 收益低，排除）。

## 已确认 / 产出

1. 用户选择「项目级 AGENTS.local.md + 全局技能」方案。
2. 新建 `AGENTS.local.md`（仓库根）：ponytail 中文常驻规则叠加层，排在现有 AGENTS.md 之后渲染；写入后 DSH 已实时动态注入当前会话（system-reminder 可见），无需重启。
3. 新建 `~/.agents/skills/ponytail/SKILL.md`：全局技能（frontmatter + 7 级阶梯 + 审查清单），DSH 技能目录已实时收录（会话技能列表可见），编码/重构/review/bugfix 任务按需加载。写入在工作区外，经用户批准 full-access 完成。
4. 明确不做：MCP 集成（DSH MCP 桥不支持 prompts，无法每轮注入）。

## 验证

- `AGENTS.local.md` 写入后本会话立即收到 "Additional instructions from: AGENTS.local.md" 动态注入。
- `SKILL.md` 写入后本会话技能目录出现 `ponytail` 条目。

## 下一步（可选）

- 如需全局常驻：可在 `~/.dsh/AGENTS.md` 放一份规则（当前不存在该文件）。
- 规则与 Trellis AGENTS.md 的关系已写明：只约束编码实现方式，不改变产品决策/记忆规则。
