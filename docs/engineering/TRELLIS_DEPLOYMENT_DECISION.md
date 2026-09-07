# Trellis 部署策略决策

> 状态：内测与准生产阶段采用  
> 日期：2026-09-02

## 结论

Trellis 产品本体继续使用 Cloudflare Workers + D1。中高级作品集阶段不迁移到 Vercel 或 GitHub Pages。

## 原因

当前 Trellis 不是静态展示站，而是包含 API、D1 持久化、身份边界、课程编排、工作流状态和 production smoke 的动态应用。现有工程已经围绕 Cloudflare Workers + D1 建立：

- 20 个 D1 迁移；
- Worker 构建产物验证；
- 远程 D1 Runbook；
- ChatGPT 托管身份约束；
- production smoke；
- `.openai/hosting.json` 部署项目记录。

在这个阶段迁移平台会引入数据库、身份、函数运行时和部署脚本重做，不能提升内测质量，也不能直接提升作品集说服力。

## 平台比较

| 方案 | 适合用途 | 当前判断 |
| --- | --- | --- |
| Cloudflare Workers + D1 | Trellis 产品本体、API、D1、边缘部署、production smoke | 继续采用 |
| Vercel | 独立作品集展示页、静态 Case Study、需要快速分享的营销页 | 可另建展示页，但不承载产品本体 |
| GitHub Pages | 静态文档或公开 README | 不适合承载 Trellis 应用 |

## 内测阶段

内测阶段以本地运行和可复现验收为准：

- `npm run check`
- `npm run acceptance:course-intelligence`
- `npm run acceptance:internal-test-loop`
- 人工记录 `docs/product/TRELLIS_INTERNAL_TEST_LOG.md`

## 准公开阶段

准备公开测试前必须完成：

- 远程 D1 执行 `0013-0019`；
- 配置生产 secrets；
- ChatGPT 托管身份联调；
- 执行 production smoke；
- 准备测试账号和回滚说明；
- 明确演示数据与个人数据边界。

## 作品集处理

作品集材料可以静态发布，但需要和产品本体分离：

- 产品本体：Cloudflare Workers + D1；
- 作品集页面：可用 Vercel、GitHub Pages 或其他静态托管；
- 截图和 Case Study：来自本地或准生产验收，不伪装成公开生产指标。
