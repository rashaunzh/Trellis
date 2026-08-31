# 2026-08-30 Trellis Round 4-5 交付收敛

## 背景

用户要求继续实现交付前 Round 4-5：`/learn` UI 交付降噪，以及部署/作品集交付检查。约束是不继续扩核心能力，不新增账号、社交、课程市场、向量记忆或完整 MCP server。

## 本轮完成

- `/learn` 第一屏改为三块焦点：
  - 本次行动：只显示一个 next action，含课程 slice、预计时间、轻反馈模式和打开行动按钮。
  - 本周只看：最多显示 3 个本周主线 course slice，并保留核心完成进度。
  - 待处理：汇总待评审、需修订、复盘未归档、可生成下周和待确认建议。
- `/learn` 二级信息默认折叠：
  - 本周全部行动卡。
  - 本周材料取舍。
  - 学习产出。
  - 阶段作品闭环。
  - 本周看板。
  - 调整记录。
  - 系统状态已继续保持折叠。
- 活动抽屉优先显示“先做这一小段”：当前行动绑定的课程切片、看哪段、看完回答什么、看完做什么。长文本证据入口改为补充入口；只有作品任务才显示“提交作品证据”。
- `/workbench` 材料卡保持切片统计为默认信息，全部切片改成 `details` 点击展开，避免材料页再次变成资料墙。
- 新增 `scripts/production-smoke.mjs` 与 `npm run smoke:production`：
  - 设置 `TRELLIS_BASE` 时检查线上 `/learn`、`/workbench`、`/api/learning/workspace`、`/api/learning/week-review`。
  - 未设置 `TRELLIS_BASE` 时跳过，不阻塞本地验证。
- 更新部署 runbook、README、case study、3 分钟 demo script 和日用 2.0 文档，交付叙事统一为“内容过载 -> 课程切片 -> 本次行动 -> 轻反馈 -> 周复盘 -> 下周”。
- `scripts/acceptance-three-week-loop.mjs` 增加 UI 验收：
  - `/learn` 渲染本次行动、本周只看、待处理三块。
  - 活动抽屉优先显示课程切片和轻反馈。

## 验证

- `npx tsc --noEmit --incremental false` 通过。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"` 通过，200/200。
- `node --test tests/*.test.mjs` 通过，6/6。
- `npm run lint` 通过。
- `npm run build` 通过；仍有既有 `gray-matter` direct eval warning 和 vinext 动态路由分类提示。
- `npm run acceptance:three-week-loop` 通过；截图已刷新。
- `npm run delivery:precheck` 通过。
- `npm run smoke:production` 在未设置 `TRELLIS_BASE` 时按设计跳过。

## 当前边界

- 尚未执行真实线上部署；production smoke 需要部署 URL 后再跑。
- UI 已显著降噪，但仍是桌面优先；手机端只做了基础堆叠和不崩兜底。
- 课程切片仍是规则版目录/摘要解析，不自动抓取完整视频、PDF 或字幕。
- 外部 AI API 仍是增强项，不是核心流程依赖。

## 下一步

1. 设置真实 `TRELLIS_BASE` 后跑 `npm run smoke:production`。
2. 部署前确认远程 D1 已应用 `drizzle/0012_week_reviews.sql`。
3. 准备作品集页面截图与 draw.io 功能架构图；技术架构图可从 `docs/architecture/TRELLIS_DELIVERY_ARCHITECTURE.md` 的 Mermaid 流程改稿。
