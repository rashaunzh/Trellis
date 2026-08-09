# Current Handoff

Updated: 2026-08-07

## Current objective

完成 Trellis V0.1 的构建、运行验证与 owner-only 发布，然后开始第一周 Notebook 测评真实使用。

## Implemented

- Trellis 品牌、四主线路线图和阶段看板。
- 六种状态：进行中、短期启动、长期规划、暂停、完成、待确认。
- 0.5 星 / 15 分钟预算和实际用时记录。
- 动态任务添加与任务详情。
- 任务理由、阶段顺序、边界、前置、下一步、资料、证据。
- 复制 AI 最小上下文包并回写讨论摘要。
- Notebook 测评 6 步完整项目链路。
- 概念闪卡：官方解释、白话解释、例子、误区、来源与熟悉状态。
- 专用 AI / 知识工具地图及回写边界。
- 学习、求职、商业和想法各阶段的长期入口任务。
- 周复盘及“安排是否有效”反馈。
- D1 API 新状态、旧状态兼容和新版 starter records。
- CI 工作流与 Trellis SSR 测试。

## Authoritative branch

- GitHub repository: `rashaunzh/AI-Learning-OS`
- Branch: `codex/trellis-foundation-memory`
- Draft PR: https://github.com/rashaunzh/AI-Learning-OS/pull/1
- Sites project: `appgprj_6a72003abefc8191a4bd0c79702ee892`
- Sites display title has been updated to Trellis; existing production URL still serves the old deployed version.

## Validation still required

1. Run `npm test` on the exact branch head.
2. Fix any build/type/render failure.
3. Push the verified source state to the Sites-configured `main` source branch.
4. Save a Sites version and inspect build/screenshot.
5. Because the access policy is owner-only, use the private deployment path after verification.
6. Test task create, status move, evidence save, AI summary save, review save and refresh persistence.

## Current tooling issue

The desktop shell command layer hangs even for `cmd /c echo` in `C:\tmp`. Two command styles and multiple working directories were tried and terminated. GitHub connector writes work normally. GitHub Actions currently reports no run for the branch workflow.

## First real task after deployment

Open **NB-01 确定 Notebook 测评对象与核心资料** and fill:

- NotebookLM or Gemini Notebook link
- 3–5 core source links
- one-sentence evaluation goal
- actual minutes
- evidence/result
- any AI discussion summary

## Do not do yet

- Do not build MCP, automatic Inbox sync, a live timer, or paid model routing.
- Do not expand V0.2 before one-week signals and two-week real use.
- Do not expose the owner-only site or sensitive source material.
