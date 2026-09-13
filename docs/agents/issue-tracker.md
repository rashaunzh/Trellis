# Issue 跟踪：GitHub

本仓库的 issue 和规格说明以 GitHub issue 的形式存在。所有操作使用 `gh` CLI。

## 约定

- **创建 issue**：`gh issue create --title "..." --body "..."`。多行 body 使用 heredoc。
- **读取 issue**：`gh issue view <number> --comments`，用 `jq` 过滤评论，同时获取 labels。
- **列出 issue**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，按需加 `--label` 和 `--state` 过滤。
- **评论 issue**：`gh issue comment <number> --body "..."`
- **添加 / 移除标签**：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **关闭**：`gh issue close <number> --comment "..."`

在克隆目录内运行时 `gh` 会自动从 `git remote -v` 推断仓库。

## 以 PR 作为分诊入口

**将外部 PR 作为请求入口：否。** _（如果本仓库将外部 PR 视为功能请求，改为 `yes`；`/triage` 会读取此标记。）_

设为 `yes` 时，PR 与 issue 使用相同的标签和状态，用 `gh pr` 对应命令操作：

- **读取 PR**：`gh pr view <number> --comments`，diff 用 `gh pr diff <number>`。
- **列出待分诊的外部 PR**：`gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`，仅保留 `authorAssociation` 为 `CONTRIBUTOR`、`FIRST_TIME_CONTRIBUTOR` 或 `NONE` 的（排除 `OWNER`/`MEMBER`/`COLLABORATOR`）。
- **评论 / 标签 / 关闭**：`gh pr comment`、`gh pr edit --add-label`/`--remove-label`、`gh pr close`。

GitHub 中 issue 和 PR 共用一个编号空间，因此裸 `#42` 可能是两者之一：先 `gh pr view 42`，失败再回退 `gh issue view 42`。

## 当 skill 说“发布到 issue 跟踪器”

创建 GitHub issue。

## 当 skill 说“获取相关 ticket”

运行 `gh issue view <number> --comments`。

## Wayfinding 操作

供 `/wayfinder` 使用。**地图（map）** 是一个 issue，**子（child）** issue 是其 ticket。

- **地图**：一个带 `wayfinder:map` 标签的 issue，正文包含 Notes / Decisions-so-far / Fog。`gh issue create --label wayfinder:map`。
- **子 ticket**：作为 GitHub sub-issue 关联到地图（`gh api` 调用 sub-issues 端点）。sub-issue 不可用时，把子项加进地图正文的任务列表，并在子 issue 正文顶部写 `Part of #<map>`。标签：`wayfinder:<type>`（`research`/`prototype`/`grilling`/`task`）。被认领后 ticket 指派给驱动开发的开发者。
- **阻塞**：使用 GitHub **原生 issue dependencies**（UI 可见的规范表示）。添加边：`gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`，其中 `<blocker-db-id>` 是阻塞者的数字 **database id**（`gh api repos/<owner>/<repo>/issues/<n> --jq .id`，不是 `#number` 或 `node_id`）。依赖功能不可用时，回退为在子 issue 正文顶部写 `Blocked by: #<n>, #<n>`。所有阻塞者关闭即视为解除阻塞。
- **前沿查询**：列出地图的 open 子项（`gh issue list --state open`，限定地图的 sub-issue / 任务列表），排除有 open 阻塞者（`issue_dependencies_summary.blocked_by > 0`，或 `Blocked by` 行中有 open issue）或已有 assignee 的；按地图顺序取第一个。
- **认领**：`gh issue edit <n> --add-assignee @me`，作为本次会话的第一次写入。
- **解决**：`gh issue comment <n> --body "<answer>"`，然后 `gh issue close <n>`，再把上下文指针（gist + 链接）追加到地图的 Decisions-so-far。
