# 2026-09-05 来源对象与拆解

## 完成

- 新增通用 `ContentSource` 与 `ContentFragment` 合同，覆盖课程、文章、视频、GitHub、Hugging Face、帖子和笔记。
- 新增规则版内容拆解入口：来源先进入 inbox，分析后进入 needs_review，用户确认片段后才进入 confirmed。
- 新增 D1 迁移 0020、内存仓库和 D1 仓库实现，保存来源、分析版本和候选片段。
- 新增来源创建、列表、详情、分析和确认 API，并把来源对象接入工作台。
- 工作台新增来源对象区，能看到分析状态、候选数量、置信度并执行分析/确认。

## 验证

- `npm run typecheck` 通过。
- `npm run lint` 通过。
- `npm run test:domain` 通过，242/242。
- `npm run db:verify` 通过，21 个迁移文件。
- `npm run build` 通过。
- `node --test tests/rendered-html.test.mjs` 通过，5/5。
- 本地 HTTP 通过：创建来源 → 分析 → 确认 → 列表读取。

## 限制

当前拆解为规则版候选映射，不抓取网页正文，不自动修改已确认路线。远程 D1 仍需按部署流程执行 0013-0020；人工内测记录仍需要真实走查产生，不能由脚本替代。
