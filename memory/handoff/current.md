# Current Handoff

Updated: 2026-08-10

## Current objective

将已合并并通过 CI 的 Trellis V0.1 发布到 owner-only Sites，完成线上冒烟验证，然后开始第一周 Notebook 测评真实使用。

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
- CI 工作流、Trellis SSR 测试及 Sites 发布构建包上传。

## Authoritative source

- GitHub repository: `rashaunzh/AI-Learning-OS`
- Release PR: https://github.com/rashaunzh/AI-Learning-OS/pull/2
- Release PR CI: passed
- Squash merge commit: `d0427b05d98ed0b24dfd76f79c9d90a0594840d3`
- Current release-tooling commit on `main`: `fcd8b2cbaed3991809c610674462a445f3e2527d`
- Sites project: `appgprj_6a72003abefc8191a4bd0c79702ee892`
- Sites title: Trellis
- Production URL: https://ai-learning-os.rashaunzh.chatgpt.site
- Access: custom, owner only
- Production is still version 7 and does not yet contain Trellis V0.1.

## Completed validation

1. Pull request branch was rebased onto the latest `main` before release.
2. GitHub Actions ran `npm ci` and `npm test` successfully on PR #2.
3. PR #2 was merged into `main`.
4. The old superseded PR #1 was closed.
5. CI now packages `dist` as a short-retention Sites artifact.

## Release still required

1. Produce a CI artifact for the exact release handoff commit.
2. Push the exact verified source state to the Sites-configured `main` source branch.
3. Save and privately deploy a new Sites version.
4. Inspect deployment status and screenshot.
5. Test task create, status move, evidence save, AI summary save, review save and refresh persistence.

## Current tooling issue

The desktop shell command layer still hangs even for a directory listing, so GitHub and Sites connector operations are being used wherever possible. A Sites deployment must not be saved until its exact verified source state has been pushed to the configured Sites source repository.

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
