# 2026-08-30 Course Intelligence 纵向切片实现

## 本轮目标

按确认的六轮重构计划，先落地一条可运行、可验证的生产形态主链：目标与课程目录进入、领域与课程判断、个人课程组合、确认、准确章节学习、领域图和辅助工作台。

## 已完成

- 新增 10 个来源、30 门代表课程或参考、36 节点 AI 发布领域图。
- 新增 Course Genome、章节节点映射、课程组合、发布检查和课程版本影响契约。
- 新增服务端 OpenAI-compatible 模型网关，支持 Zod、超时、重试、缓存和运行记录；无 Key 时使用发布基线。
- 新增 D1 迁移 `0013_course_intelligence.sql` 及 repository。
- 新增 intake、material analyze、curriculum read/confirm、intelligence state API。
- `/learn` 改为目标、方案、学习三态；`/grow` 改为长领域图；`/workbench` 回归辅助工具空间。
- DeepLearning.AI 总目录被识别为候选范围，不再静默混入其他平台；ML 专项不作为 AI PM 默认前置。
- 新增课程智能浏览器验收和四张截图。

## 复用与退出

复用：D1、owner 隔离、周计划、活动、学习反馈、节点进度及已有 API service 边界。

退出正式入口：固定 AI PM 路线、假画像、六步英文展示、前三周动态演示、默认作品、Quality/Eval/Mastra 页面展示、关键词式 Course Slicer。

## 未完成

- 生产定时来源抓取与候选内容内部评审台；
- 私有长材料解析和 BYOK UI；
- 线上部署、远程 D1 迁移和生产 smoke；
- 真实账号权限；
- 旧兼容模块物理删除。

## 最终验证

- `npx tsc --noEmit --incremental false`：通过。
- 领域测试：209/209 通过。
- 构建产物测试：6/6 通过。
- `npm run lint`：通过。
- `npm run build`：通过；保留既有 `gray-matter` direct eval 和 vinext 路由分类提示。
- `npm run acceptance:course-intelligence`：通过。
- `npm run delivery:precheck`：通过。
