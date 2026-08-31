# 2026-08-30 Trellis 交付前三轮功能完善

## 背景

用户确认按“交付前 3 轮功能完善计划”直接实现：Course Slicer v2、轻启动学习闭环与 `/learn` 降噪、部署/架构图/作品集包装。

## 本轮完成

- Course Slicer v2：
  - `CourseSlice` 增加 `difficulty`。
  - 用户粘贴课程目录、视频目录、文章目录或摘要时，规则版会从多行目录切出多个 slice。
  - 每段 slice 标记 `本周主线`、`后续再用`、`只作参考` 或 `暂不碰`。
  - 高阶部署、微调、benchmark、数学证明等内容默认标为偏难并跳过，不进入 AI PM 入门本周主线。
  - 行动卡继续通过 `courseSliceIds` 绑定具体片段。
- `/workbench`：
  - 材料卡展示切片统计：已切几段、本周几段、后续几段、参考几段、跳过几段。
  - 用户新增材料后刷新 workspace，保证切片统计即时可见。
- `/learn`：
  - 计划历史折叠为紧凑 summary，并露出最近周 key，避免第一屏过载又保留连续周感知。
  - 反馈措辞从“作业/产出证据”调整为“轻反馈 / 小产出”和“深度选择”。
- 交付材料：
  - 新增 `docs/product/TRELLIS_PORTFOLIO_CASE_STUDY.md`。
  - 新增 `docs/engineering/TRELLIS_3_MIN_DEMO_SCRIPT.md`。
  - 新增 `docs/architecture/TRELLIS_DELIVERY_ARCHITECTURE.md`。
  - 新增 `scripts/delivery-precheck.mjs` 与 `npm run delivery:precheck`。
  - 更新 README 和 `docs/product/TRELLIS_DAILY_USABLE_2_0.md`。

## 验证

- `npx tsc --noEmit --incremental false` 通过。
- `node --test --test-isolation=none "tests/learning-domain/*.test.ts"` 通过，200/200。
- `node --test tests/*.test.mjs` 通过，6/6。
- `npm run lint` 通过。
- `npm run build` 通过；仍有既有 `gray-matter` direct eval warning 和 vinext 路由静态分类提示。
- `npm run acceptance:three-week-loop` 通过，截图已刷新：
  - `docs/acceptance-three-week-learn.png`
  - `docs/acceptance-three-week-review-history.png`
  - `docs/acceptance-three-week-artifact-loop.png`
- `npm run delivery:precheck` 通过。

## 当前边界

- Course Slicer v2 是规则版目录/摘要切分，不抓取完整视频、PDF 或字幕。
- 片段判断是启发式规则，不是外部模型理解全文；外部 AI 后续只作为长文本解析和表达增强。
- `/learn` 已降噪但仍偏信息密度型，下一轮 UI 仍需要更强的第一屏压缩。
- 作品闭环仍是可选路径，不再作为 AI PM 入门默认目标。

## 下一步建议

1. 进入 UI 交付轮：把 `/learn` 第一屏进一步压成“本次行动 + 本周只看片段 + 待处理事项”，其他区块继续折叠或移到二级视图。
2. 做部署预演：应用远程 D1 migration、检查环境变量、跑生产 URL smoke test。
3. 用 case study 和 3 分钟 script 组织作品集页面，并补 draw.io 功能架构图与 archify 风格技术架构图。
